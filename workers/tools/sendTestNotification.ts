/**
 * Tool to send a test push notification to a user
 * This executes automatically without requiring human confirmation
 */
import { tool } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getCurrentAgent } from "agents";
import { getDb } from "~/lib/db";
import { pushSubscriptions } from "~/lib/push-subscriptions-schema";
import { sendWebPushNotification } from "~/lib/web-push-helpers";
import type { Chat } from "../chat-agent";

export const sendTestNotification = tool({
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

