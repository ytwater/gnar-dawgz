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
	const auth = createAuth(env, (request as any).cf);
	const db = getDb(env.DB);

	// Get the session
	const session = await auth.api.getSession({ headers: request.headers });
	const handler = new RPCHandler(appRouter);
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

	return response;
}
