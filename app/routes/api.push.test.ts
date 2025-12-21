import { eq } from "drizzle-orm";
import { createAuth } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { pushSubscriptions } from "~/lib/push-subscriptions-schema";
import { sendWebPushNotification } from "~/lib/web-push-helpers";
import type { Route } from "./+types/api.push.test";

export async function action({ request, context }: Route.ActionArgs) {
	try {
		const env = context.cloudflare.env as CloudflareBindings;
		const auth = createAuth(env, (request as { cf?: unknown }).cf);
		const db = getDb(env.DB);

		// Get the session
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user?.id) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get the user's push subscription
		const subscriptions = await db
			.select()
			.from(pushSubscriptions)
			.where(eq(pushSubscriptions.userId, session.user.id))
			.limit(1);

		if (subscriptions.length === 0) {
			return Response.json(
				{ error: "No push subscription found" },
				{ status: 404 },
			);
		}

		const subscription = subscriptions[0];

		// Get VAPID keys from environment
		const publicKey = env.VAPID_PUBLIC_KEY;
		const privateKey = env.VAPID_PRIVATE_KEY;
		const subject = env.VAPID_SUBJECT || "mailto:admin@gnar-dawgs.com";

		if (!publicKey || !privateKey) {
			return Response.json(
				{ error: "VAPID keys not configured" },
				{ status: 500 },
			);
		}

		console.log("VAPID Public Key being used:", publicKey);
		console.log("Stored subscription endpoint:", subscription.endpoint);
		console.log("Stored subscription keys:", {
			hasP256dh: !!subscription.p256dh,
			hasAuth: !!subscription.auth,
			p256dh: subscription.p256dh?.substring(0, 20) + "...",
			auth: subscription.auth?.substring(0, 10) + "...",
		});

		// Verify subscription endpoint is valid (not expired)
		if (!subscription.endpoint.startsWith("https://")) {
			return Response.json(
				{ error: "Invalid subscription endpoint" },
				{ status: 400 },
			);
		}

		// Create the notification payload
		// Try empty payload first to test if encryption is the issue
		// const notificationPayload = "";
		const notificationPayload = JSON.stringify({
			title: "Test Notification",
			body: "This is a test notification from Gnar Dawgs! 🏂",
			icon: "/icon-192.png",
			badge: "/icon-192.png",
		});

		// Uncomment to test with empty payload:
		// const notificationPayload = "";

		// Validate keys before sending
		if (!subscription.p256dh || !subscription.auth) {
			return Response.json(
				{ error: "Invalid subscription keys" },
				{ status: 400 },
			);
		}

		// Send the notification using Web Push protocol
		try {
			console.log("TRYING TO SEND NOTIFICATION");
			console.log("Keys validation:", {
				p256dhLength: subscription.p256dh.length,
				authLength: subscription.auth.length,
				p256dhValid: /^[A-Za-z0-9_-]+$/.test(subscription.p256dh),
				authValid: /^[A-Za-z0-9_-]+$/.test(subscription.auth),
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

			return Response.json({
				success: true,
				message: "Test notification sent successfully!",
			});
		} catch (pushError: unknown) {
			console.error("Web push error:", pushError);
			const errorMessage =
				pushError instanceof Error ? pushError.message : String(pushError);
			const errorStack =
				pushError instanceof Error ? pushError.stack : undefined;
			console.error("Error details:", { errorMessage, errorStack });
			return Response.json(
				{
					error: `Failed to send notification: ${errorMessage}`,
					details: errorStack,
				},
				{ status: 500 },
			);
		}
	} catch (error) {
		console.error("Error sending test notification:", error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;
		return Response.json(
			{
				error: `Failed to send test notification: ${errorMessage}`,
				details: errorStack,
			},
			{ status: 500 },
		);
	}
}
