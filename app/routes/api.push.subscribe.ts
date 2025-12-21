import { eq } from "drizzle-orm";
import { createAuth } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { pushSubscriptions } from "~/lib/push-subscriptions-schema";
import type { Route } from "./+types/api.push.subscribe";

export async function action({ request, context }: Route.ActionArgs) {
	try {
		const env = context.cloudflare.env as CloudflareBindings;
		const auth = createAuth(env, request.cf);
		const db = getDb(env.DB);

		// Get the session from the auth header
		const session = await auth.api.getSession({ headers: request.headers });
		console.log("🚀 ~ api.push.subscribe.ts:15 ~ action ~ session:", session);
		if (!session?.user?.id) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { endpoint, keys } = body;

		if (!endpoint || !keys?.p256dh || !keys?.auth) {
			return Response.json(
				{ error: "Invalid subscription data" },
				{ status: 400 },
			);
		}

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

		return Response.json({ success: true });
	} catch (error) {
		console.error("Error subscribing to push notifications:", error);
		return Response.json(
			{ error: "Failed to subscribe to push notifications" },
			{ status: 500 },
		);
	}
}
