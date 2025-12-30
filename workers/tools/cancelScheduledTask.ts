/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
import { tool } from "ai";
import { z } from "zod";
import { getCurrentAgent } from "agents";
import type { Chat } from "../chat-agent";

export const cancelScheduledTask = tool({
	description: "Cancel a scheduled task using its ID",
	inputSchema: z.object({
		taskId: z.string().describe("The ID of the task to cancel"),
	}),
	execute: async ({ taskId }) => {
		const { agent } = getCurrentAgent<Chat>();
		if (!agent) {
			return "Error: Agent not found";
		}
		try {
			await agent.cancelSchedule(taskId);
			return `Task ${taskId} has been successfully canceled.`;
		} catch (error) {
			console.error("Error canceling scheduled task", error);
			return `Error canceling task ${taskId}: ${error}`;
		}
	},
});
