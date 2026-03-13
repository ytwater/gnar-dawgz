import { RPCHandler } from "@orpc/server/fetch";
import { createAuth } from "~/app/lib/auth";
import { getDb } from "~/app/lib/db";
import { appRouter } from "~/app/lib/orpc/router";
import type { Route } from "./+types/api.orpc.$";

export async function loader({ request, context }: Route.LoaderArgs) {
	return handle(request, context);
}

export async function action({ request, context }: Route.ActionArgs) {
	return handle(request, context);
}

async function handle(request: Request, context: Route.LoaderArgs["context"]) {
	const env = context.cloudflare.env as CloudflareBindings;
	// biome-ignore lint/suspicious/noExplicitAny: Cloudflare request object has .cf
	const auth = createAuth(env, (request as any).cf);
	const db = getDb(env.DB);

	// Get the session
	const session = await auth.api.getSession({ headers: request.headers });
	const handler = new RPCHandler(appRouter);

	console.log("[api.orpc] Handling request", {
		method: request.method,
		url: request.url,
		hasSession: !!session,
		userId: session?.user?.id,
	});

	try {
		const { response } = await handler.handle(request, {
			prefix: "/api/orpc",
			context: {
				env,
				db,
				auth,
				session: session
					? {
							...session,
							session: {
								...session.session,
								ipAddress: session.session.ipAddress ?? null,
								userAgent: session.session.userAgent ?? null,
							},
						}
					: null,
			},
		});

		if (response && response.status >= 400) {
			const cloned = response.clone();
			const body = await cloned.text();
			console.error("[api.orpc] Error response", {
				status: response.status,
				body: body.substring(0, 500),
			});
		}

		return response;
	} catch (err) {
		console.error("[api.orpc] Unhandled error", err);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
