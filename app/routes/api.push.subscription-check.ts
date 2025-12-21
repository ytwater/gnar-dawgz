import { eq } from "drizzle-orm";
import { createAuth } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { pushSubscriptions } from "~/lib/push-subscriptions-schema";
import type { Route } from "./+types/api.push.subscription-check";

export async function loader({ request, context }: Route.LoaderArgs) {
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
			return Response.json({ endpoint: null });
		}

		return Response.json({
			endpoint: subscriptions[0].endpoint,
		});
	} catch (error) {
		console.error("Error checking subscription:", error);
		return Response.json({ error: "Failed to check subscription" }, { status: 500 });
	}
}

