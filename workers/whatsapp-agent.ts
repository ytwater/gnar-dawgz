import { getSchedulePrompt } from "agents/schedule";

import { createDeepSeek } from "@ai-sdk/deepseek";
import {
	type CoreMessage,
	generateId,
	generateText,
	stepCountIs,
	streamText,
} from "ai";
import { getDb } from "app/lib/db";
import { whatsappMessages } from "app/lib/schema";
import type { User } from "better-auth";
import { and, eq, gte } from "drizzle-orm";
import { executions, tools } from "./tools";
import { createSurfForecastTool } from "./tools/createSurfForecastTool";

/**
 * WhatsApp Agent implementation that handles WhatsApp messages via Twilio
 * Uses AI SDK directly without Durable Objects for simpler webhook handling
 */
export class WhatsAppAgent {
	private messages: CoreMessage[] = [];
	private env: CloudflareBindings;
	private user: User;

	constructor(env: CloudflareBindings, user: User) {
		this.env = env;
		this.user = user;
	}

	/**
	 * Load conversation history from database (last 24 hours)
	 */
	async loadHistory(): Promise<void> {
		const db = getDb(this.env.DB);
		const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

		const recentMessages = await db
			.select()
			.from(whatsappMessages)
			.where(
				and(
					eq(whatsappMessages.userId, this.user.id),
					gte(whatsappMessages.createdAt, new Date(twentyFourHoursAgo)),
				),
			)
			.orderBy(whatsappMessages.createdAt);

		this.messages = recentMessages.map((msg) => ({
			role: msg.role as "user" | "assistant",
			content: msg.content,
		}));
	}

	/**
	 * Save a message to the database
	 */
	private async saveMessage(
		role: "user" | "assistant",
		content: string,
	): Promise<void> {
		const db = getDb(this.env.DB);
		await db.insert(whatsappMessages).values({
			id: generateId(),
			userId: this.user.id,
			role,
			content,
			createdAt: new Date(),
		});
	}

	/**
	 * Handles incoming WhatsApp messages and returns AI-generated responses
	 */
	async onMessage(senderNumber: string, text: string): Promise<string> {
		console.log("WhatsAppAgent.onMessage called", { senderNumber, text });

		// Load history if not already loaded
		if (this.messages.length === 0) {
			await this.loadHistory();
		}

		// Add the user's message to the conversation history
		this.messages.push({
			role: "user",
			content: text,
		});

		// Save user message to database
		await this.saveMessage("user", text);

		const getSurfForecast = createSurfForecastTool(this.env);

		// Collect all tools (MCP tools would need to be added here if needed)
		const allTools = {
			getSurfForecast,
		};

		const baseURL = `https://gateway.ai.cloudflare.com/v1/${this.env.ACCOUNT_ID}/${this.env.AI_GATEWAY_ID}/deepseek`;
		console.log("DeepSeek baseURL:", baseURL);

		const deepseek = createDeepSeek({
			apiKey: this.env.DEEPSEEK_API_KEY ?? "",
			baseURL,
			headers: {
				"cf-aig-authorization": this.env.CLOUDFLARE_API_TOKEN ?? "",
			},
		});
		const model = deepseek.languageModel("deepseek-chat");

		// Generate response using streamText (we'll collect the full text)
		const result = await generateText({
			system: `You are a helpful assistant that can do various tasks via WhatsApp. Keep responses concise and friendly.  You should default to telling the user what you can do.  You can use the getSurfForecast tool to get the surf forecast.  The defaults to Torrey Pines beach, no need to specify the location. It can take a start and end date to get the forecast for a specific period.  If no start or end date is provided, it will default to tomorrow and the day after.  If the user asks about this week, assume that it's midweek, Monday - Friday.  Weekends should be the coming weekend.
`,

			messages: this.messages,
			model,
			tools: allTools,
			stopWhen: stepCountIs(10),
		});

		// Collect the full response text
		let responseText = result.text ?? "";

		// Handle tool calls if any were made
		const toolCalls = result.toolCalls;
		if (toolCalls && toolCalls.length > 0) {
			// Execute tools automatically (for WhatsApp, we auto-approve safe tools)
			for (const toolCall of toolCalls) {
				const toolName = toolCall.toolName as keyof typeof executions;
				console.log(
					"🚀 ~ whatsapp-agent.ts:74 ~ WhatsAppAgent ~ onMessage ~ toolName:",
					toolName,
				);
				if (toolName in executions) {
					try {
						const toolInstance = executions[toolName];
						// Tool calls from generateText have args property
						if ("args" in toolCall && toolCall.args) {
							// Execution functions expect (args, context) but some implementations
							// may only use args. Match the pattern from utils.ts
							const toolResult = await (
								toolInstance as (
									args: unknown,
									context: { messages: CoreMessage[]; toolCallId: string },
								) => Promise<unknown>
							)(toolCall.args, {
								messages: this.messages,
								toolCallId: toolCall.toolCallId,
							});
							console.log(
								"🚀 ~ whatsapp-agent.ts:82 ~ WhatsAppAgent ~ onMessage ~ toolResult:",
								toolResult,
							);
							// Append tool result to response if needed
							if (toolResult && typeof toolResult === "string") {
								responseText += `\n\n${toolResult}`;
							}
						}
					} catch (error) {
						console.error("Error executing tool:", error);
						responseText += `\n\nError: ${error instanceof Error ? error.message : "Unknown error"}`;
					}
				} else {
					// Tool has execute function, result should already be in response
					console.log("Tool executed automatically:", toolName);
				}
			}
		}

		// Add the assistant's response to history
		this.messages.push({
			role: "assistant",
			content: responseText,
		});

		// Save assistant message to database
		await this.saveMessage("assistant", responseText);

		return responseText;
	}

	/**
	 * Get the current conversation history
	 */
	getHistory(): CoreMessage[] {
		return this.messages;
	}

	/**
	 * Set the conversation history (useful for restoring state)
	 */
	setHistory(messages: CoreMessage[]): void {
		this.messages = messages;
	}
}
