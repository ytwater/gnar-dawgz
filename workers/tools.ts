/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { type ToolSet, tool } from "ai";
import { z } from "zod";

import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";
import { eq } from "drizzle-orm";
import { createAuth } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { pushSubscriptions } from "~/lib/push-subscriptions-schema";
import { sendWebPushNotification } from "~/lib/web-push-helpers";
import type { Chat } from "./chat-agent";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 */
const getWeatherInformation = tool({
	description: "show the weather in a given city to the user",
	inputSchema: z.object({ city: z.string() }),
	// Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
	description: "get the local time for a specified location",
	inputSchema: z.object({ location: z.string() }),
	execute: async ({ location }) => {
		console.log(`Getting local time for ${location}`);
		return "10am";
	},
});

const scheduleTask = tool({
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

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
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

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
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

/**
 * Tool to send a test push notification to a user
 * This executes automatically without requiring human confirmation
 */
const sendTestNotification = tool({
	description: "Send a test push notification to a user",
	inputSchema: z.object({
		userId: z
			.string()
			.describe("The ID of the user to send the notification to"),
	}),
	execute: async ({ userId }) => {
		const { agent } = getCurrentAgent<Chat>();
		if (!agent) {
			return "Error: Agent not found";
		}

		try {
			const db = getDb(agent.env.DB);
			const env = agent.env;

			// Get the user's push subscription
			const subscriptions = await db
				.select()
				.from(pushSubscriptions)
				.where(eq(pushSubscriptions.userId, userId))
				.limit(1);

			if (subscriptions.length === 0) {
				return `Error: No push subscription found for user ${userId}`;
			}

			const subscription = subscriptions[0];

			// Get VAPID keys from environment
			const publicKey = env.VAPID_PUBLIC_KEY;
			const privateKey = env.VAPID_PRIVATE_KEY;
			const subject = env.VAPID_SUBJECT || "mailto:admin@gnar-dawgs.com";

			if (!publicKey || !privateKey) {
				return "Error: VAPID keys not configured";
			}

			// Validate subscription endpoint
			if (!subscription.endpoint.startsWith("https://")) {
				return "Error: Invalid subscription endpoint";
			}

			// Validate keys
			if (!subscription.p256dh || !subscription.auth) {
				return "Error: Invalid subscription keys";
			}

			// Create the notification payload
			const notificationPayload = JSON.stringify({
				title: "Test Notification",
				body: "This is a test notification from Gnar Dawgs! 🏂",
				icon: "/icon-192.png",
				badge: "/icon-192.png",
			});

			// Send the notification
			await sendWebPushNotification(
				subscription.endpoint,
				subscription.p256dh,
				subscription.auth,
				notificationPayload,
				publicKey,
				privateKey,
				subject,
			);

			return `Test notification sent successfully to user ${userId}!`;
		} catch (error) {
			console.error("Error sending test notification", error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return `Error sending test notification: ${errorMessage}`;
		}
	},
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
	getWeatherInformation,
	getLocalTime,
	scheduleTask,
	getScheduledTasks,
	cancelScheduledTask,
	sendTestNotification,
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
	getWeatherInformation: async ({ city }: { city: string }) => {
		console.log(`Getting weather information for ${city}`);
		return `The weather in ${city} is sunny`;
	},
};
