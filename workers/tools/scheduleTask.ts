import { tool } from "ai";
import { scheduleSchema } from "agents/schedule";
import { getCurrentAgent } from "agents";
import type { Chat } from "../chat-agent";

export const scheduleTask = tool({
	description: "A tool to schedule a task to be executed at a later time",
	inputSchema: scheduleSchema,
	execute: async ({ when, description }) => {
		// we can now read the agent context from the ALS store
		const { agent } = getCurrentAgent<Chat>();

		function throwError(msg: string): string {
			throw new Error(msg);
		}
		if (when.type === "no-schedule") {
			return "Not a valid schedule input";
		}
		const input =
			when.type === "scheduled"
				? when.date // scheduled
				: when.type === "delayed"
					? when.delayInSeconds // delayed
					: when.type === "cron"
						? when.cron // cron
						: throwError("not a valid schedule input");
		if (!agent) {
			return "Error: Agent not found";
		}
		if (!input) {
			return "Error: Invalid schedule input";
		}
		try {
			agent.schedule(input, "executeTask", description);
		} catch (error) {
			console.error("error scheduling task", error);
			return `Error scheduling task: ${error}`;
		}
		return `Task scheduled for type "${when.type}" : ${input}`;
	},
});
