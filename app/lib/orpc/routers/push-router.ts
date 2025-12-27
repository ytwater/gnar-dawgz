import { eq } from "drizzle-orm";
import { z } from "zod";
import { pushSubscriptions } from "~/app/lib/push-subscriptions-schema";
import { sendWebPushNotification } from "~/app/lib/web-push-helpers";
import { authedProcedure, publicProcedure } from "../server";

export const pushRouter = {
	subscribe: authedProcedure
		.input(
			z.object({
				endpoint: z.string(),
				keys: z.object({
					p256dh: z.string(),
					auth: z.string(),
				}),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db, session } = context;
			const { endpoint, keys } = input;

			// Generate a unique ID for the subscription
			const subscriptionId = crypto.randomUUID();

			// Delete any existing subscriptions for this user (one subscription per user)
			await db
				.delete(pushSubscriptions)
				.where(eq(pushSubscriptions.userId, session.user.id));

			// Insert the new subscription
			await db.insert(pushSubscriptions).values({
				id: subscriptionId,
				userId: session.user.id,
				endpoint,
				p256dh: keys.p256dh,
				auth: keys.auth,
				createdAt: new Date(),
			});

			return { success: true };
		}),

	subscriptionCheck: authedProcedure.handler(async ({ context }) => {
		const { db, session } = context;

		const subscriptions = await db
			.select()
			.from(pushSubscriptions)
			.where(eq(pushSubscriptions.userId, session.user.id))
			.limit(1);

		return {
			endpoint: subscriptions[0]?.endpoint ?? null,
		};
	}),

	test: authedProcedure.handler(async ({ context }) => {
		const { db, session, env } = context;

		const subscriptions = await db
			.select()
			.from(pushSubscriptions)
			.where(eq(pushSubscriptions.userId, session.user.id))
			.limit(1);

		if (subscriptions.length === 0) {
			throw new Error("No push subscription found");
		}

		const subscription = subscriptions[0];
		const publicKey = env.VAPID_PUBLIC_KEY;
		const privateKey = env.VAPID_PRIVATE_KEY;
		const subject = env.VAPID_SUBJECT || "mailto:admin@gnar-dawgs.com";

		if (!publicKey || !privateKey) {
			throw new Error("VAPID keys not configured");
		}

		if (!subscription.p256dh || !subscription.auth) {
			throw new Error("Invalid subscription keys");
		}

		const notificationPayload = JSON.stringify({
			title: "Test Notification",
			body: "This is a test notification from Gnar Dawgs! 🏂",
			icon: "/icon-192.png",
			badge: "/icon-192.png",
		});

		await sendWebPushNotification(
			subscription.endpoint,
			subscription.p256dh,
			subscription.auth,
			notificationPayload,
			publicKey,
			privateKey,
			subject,
		);

		return {
			success: true,
			message: "Test notification sent successfully!",
		};
	}),

	unsubscribe: authedProcedure.handler(async ({ context }) => {
		const { db, session } = context;

		await db
			.delete(pushSubscriptions)
			.where(eq(pushSubscriptions.userId, session.user.id));

		return { success: true };
	}),

	vapidKey: publicProcedure.handler(async ({ context }) => {
		return {
			publicKey: context.env.VAPID_PUBLIC_KEY,
		};
	}),
};
