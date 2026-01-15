import { createDeepSeek } from "@ai-sdk/deepseek";
import {
	type CoreMessage,
	type ToolSet,
	generateId,
	generateText,
	stepCountIs,
} from "ai";
import { getDb } from "app/lib/db";
import { whatsappMessages } from "app/lib/schema";
import type { User } from "better-auth";
import { and, eq, gte } from "drizzle-orm";
import { executions } from "./tools";
import { createAssignDemeritTool } from "./tools/createAssignDemeritTool";
import { createClearDemeritsTool } from "./tools/createClearDemeritsTool";
import { createGetCharterTool } from "./tools/createGetCharterTool";
import { createGetSurfSpotsTool } from "./tools/createGetSurfSpotsTool";
import { createSurfForecastTool } from "./tools/createSurfForecastTool";
import { createUserNameTool } from "./tools/createUserNameTool";

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

		const useSwellCloud = this.env.ENABLE_SWELL_CLOUD !== "false";
		const useSurfline = this.env.ENABLE_SURFLINE !== "false";

		let getSurfForecast;
		if (useSwellCloud) {
			getSurfForecast = createSurfForecastTool(this.env, "swellcloud");
		} else if (useSurfline) {
			getSurfForecast = createSurfForecastTool(this.env, "surfline");
		}

		const getSurfSpots = createGetSurfSpotsTool(this.env);
		const updateUserName = createUserNameTool(this.env, this.user.id);
		const assignDemerit = createAssignDemeritTool(this.env, this.user.id);
		const clearDemerits = createClearDemeritsTool(this.env);
		const getCharter = createGetCharterTool(this.env);

		const isOnboarding = this.user.name === "Guest";

		// Collect all tools
		const tools: ToolSet = isOnboarding
			? {
					updateUserName,
				}
			: {
					...(getSurfForecast ? { getSurfForecast } : {}),
					getSurfSpots,
					assignDemerit,
					clearDemerits,
					getCharter,
				};

		const systemPrompt = isOnboarding
			? "You are the Gnar Dawgs onboarding assistant. A new user has just unlocked onboarding. Your job is to ask for their name. Once they give you their name, use the 'updateUserName' tool to save it and welcome the user and tell them that they can request surf forecasts and that the default location is Torrey Pines beach. Be friendly and concise. You've already sent the text 'Hey there! Welcome to Gnar Dawgs! Let's get started! 🐾'"
			: `You are a helpful assistant for the Gnar Dawgs surf collective. Keep responses concise and friendly.
You manage the Gnar Dawgs demerit tracker:
- If a member violates the 'Global Charter', anyone can assign them a demerit using the 'assignDemerit' tool.
- If a member buys a beer for someone, their active demerits can be cleared using the 'clearDemerits' tool.
- You can use the 'getCharter' tool to see the current rules if anyone asks.
- You can also provide surf forecasts using 'getSurfForecast' (default is Torrey Pines) and 'getSurfSpots'.
Be concise. If someone asks "Who has the most demerits?", tell them to check the /charter page on the website.
Search for users by name when assigning or clearing demerits.`;
		console.log(
			"🚀 ~ whatsapp-agent.ts:116 ~ WhatsAppAgent ~ onMessage ~ systemPrompt:",
			systemPrompt,
		);

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

		// Generate response using generateText
		const result = await generateText({
			system: systemPrompt,
			messages: this.messages,
			model,
			tools,
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
									context: {
										messages: CoreMessage[];
										toolCallId: string;
										env: CloudflareBindings;
										userId: string;
									},
								) => Promise<unknown>
							)(toolCall.args, {
								messages: this.messages,
								toolCallId: toolCall.toolCallId,
								env: this.env,
								userId: this.user.id,
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
