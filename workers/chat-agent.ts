import type { Schedule } from "agents";
import { getSchedulePrompt } from "agents/schedule";

import { createDeepSeek } from "@ai-sdk/deepseek";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
	type StreamTextOnFinishCallback,
	type ToolSet,
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	generateId,
	stepCountIs,
	streamText,
} from "ai";
import { executions } from "./tools";
import { cancelScheduledTask } from "./tools/cancelScheduledTask";
import { getLocalTime } from "./tools/getLocalTime";
import { getScheduledTasks } from "./tools/getScheduledTasks";
import { getWeatherInformation } from "./tools/getWeatherInformation";
import { scheduleTask } from "./tools/scheduleTask";
import { sendTestNotification } from "./tools/sendTestNotification";
import { cleanupMessages, processToolCalls } from "./utils";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<CloudflareBindings> {
	/**
	 * Handles incoming chat messages and manages the response stream
	 */
	async onChatMessage(
		onFinish: StreamTextOnFinishCallback<ToolSet>,
		_options?: { abortSignal?: AbortSignal },
	) {
		console.log("Chat.onChatMessage called");
		console.log("Env:", this.env);
		console.log("Env keys:", Object.keys(this.env));

		// Collect all tools, including MCP tools
		const allTools = {
			getWeatherInformation,
			getLocalTime,
			scheduleTask,
			getScheduledTasks,
			cancelScheduledTask,
			sendTestNotification,

			...this.mcp.getAITools(),
		};

		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
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

				// Clean up incomplete tool calls to prevent API errors
				const cleanedMessages = cleanupMessages(this.messages);

				// Process any pending tool calls from previous messages
				// This handles human-in-the-loop confirmations for tools
				const processedMessages = await processToolCalls({
					messages: cleanedMessages,
					dataStream: writer,
					tools: allTools,
					executions,
				});

				const result = streamText({
					system: `You are a helpful assistant that can do various tasks... 

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.
`,

					messages: convertToModelMessages(processedMessages),
					model,
					tools: allTools,
					// Type boundary: streamText expects specific tool types, but base class uses ToolSet
					// This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
					onFinish: onFinish as unknown as StreamTextOnFinishCallback<
						typeof allTools
					>,
					stopWhen: stepCountIs(10),
				});

				writer.merge(result.toUIMessageStream());
			},
		});

		return createUIMessageStreamResponse({ stream });
	}
	async executeTask(description: string, _task: Schedule<string>) {
		await this.saveMessages([
			...this.messages,
			{
				id: generateId(),
				role: "user",
				parts: [
					{
						type: "text",
						text: `Running scheduled task: ${description}`,
					},
				],
				metadata: {
					createdAt: new Date(),
				},
			},
		]);
	}
}
