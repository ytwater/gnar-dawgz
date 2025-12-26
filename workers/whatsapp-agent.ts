import { getSchedulePrompt } from "agents/schedule";

import { createDeepSeek } from "@ai-sdk/deepseek";
import {
	type CoreMessage,
	stepCountIs,
	streamText,
} from "ai";
import { executions, tools } from "./tools";

/**
 * WhatsApp Agent implementation that handles WhatsApp messages via Twilio
 * Uses AI SDK directly without Durable Objects for simpler webhook handling
 */
export class WhatsAppAgent {
	private messages: CoreMessage[] = [];
	private env: CloudflareBindings;

	constructor(env: CloudflareBindings) {
		this.env = env;
	}

	/**
	 * Handles incoming WhatsApp messages and returns AI-generated responses
	 */
	async onMessage(senderNumber: string, text: string): Promise<string> {
		console.log("WhatsAppAgent.onMessage called", { senderNumber, text });

		// Add the user's message to the conversation history
		this.messages.push({
			role: "user",
			content: text,
		});

		// Collect all tools (MCP tools would need to be added here if needed)
		const allTools = {
			...tools,
			// TODO: Add MCP tools if needed
			// ...this.mcp.getAITools(),
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
		const result = await streamText({
			system: `You are a helpful assistant that can do various tasks via WhatsApp. Keep responses concise and friendly.

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.
`,

			messages: this.messages,
			model,
			tools: allTools,
			stopWhen: stepCountIs(10),
		});

		// Collect the full response text
		let responseText = "";
		for await (const chunk of result.textStream) {
			responseText += chunk;
		}

		// Handle tool calls if any were made
		const toolCalls = result.toolCalls;
		if (toolCalls && toolCalls.length > 0) {
			// Execute tools automatically (for WhatsApp, we auto-approve safe tools)
			for (const toolCall of toolCalls) {
				const toolName = toolCall.toolName as keyof typeof executions;
				if (toolName in executions) {
					try {
						const toolInstance = executions[toolName];
						const toolResult = await toolInstance(
							toolCall.args as never,
							{
								messages: this.messages,
								toolCallId: toolCall.toolCallId,
							},
						);
						// Append tool result to response if needed
						if (toolResult && typeof toolResult === "string") {
							responseText += `\n\n${toolResult}`;
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

