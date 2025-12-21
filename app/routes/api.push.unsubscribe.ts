import { eq } from "drizzle-orm";
import { createAuth } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { pushSubscriptions } from "~/lib/push-subscriptions-schema";
import type { Route } from "./+types/api.push.unsubscribe";

export async function action({ request, context }: Route.ActionArgs) {
	try {
		const env = context.cloudflare.env as CloudflareBindings;
		const auth = createAuth(env, request.cf);
		const db = getDb(env.DB);

		// Get the session from the auth header
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user?.id) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Delete all subscriptions for this user
		await db
			.delete(pushSubscriptions)
			.where(eq(pushSubscriptions.userId, session.user.id));

		return Response.json({ success: true });
	} catch (error) {
		console.error("Error unsubscribing from push notifications:", error);
		return Response.json(
			{ error: "Failed to unsubscribe from push notifications" },
			{ status: 500 },
		);
	}
}
