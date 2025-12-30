/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
import { tool } from "ai";
import { z } from "zod";
import { getCurrentAgent } from "agents";
import type { Chat } from "../chat-agent";

export const getScheduledTasks = tool({
	description: "List all tasks that have been scheduled",
	inputSchema: z.object({}),
	execute: async () => {
		const { agent } = getCurrentAgent<Chat>();

		if (!agent) {
			return "Error: Agent not found";
		}
		try {
			const tasks = agent.getSchedules();
			if (!tasks || tasks.length === 0) {
				return "No scheduled tasks found.";
			}
			return tasks;
		} catch (error) {
			console.error("Error listing scheduled tasks", error);
			return `Error listing scheduled tasks: ${error}`;
		}
	},
});
