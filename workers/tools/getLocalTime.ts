/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
import { tool } from "ai";
import { z } from "zod";

export const getLocalTime = tool({
	description: "get the local time for a specified location",
	inputSchema: z.object({ location: z.string() }),
	execute: async ({ location }) => {
		console.log(`Getting local time for ${location}`);
		return "10am";
	},
});
