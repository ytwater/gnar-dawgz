import { RPCHandler } from "@orpc/server/fetch";
import { createAuth } from "~/app/lib/auth";
import { getDb } from "~/app/lib/db";
import { appRouter } from "./router";
import type { ORPCContext } from "./server";

// Create a server-side ORPC client that can call procedures directly
export function createServerORPCClient(context: {
	env: CloudflareBindings;
	request: Request;
}): typeof appRouter {
	const { env, request } = context;
	const auth = createAuth(env, (request as any).cf);
	const db = getDb(env.DB);

	// Get the session
	let session: ORPCContext["session"] = null;
	(async () => {
		const authSession = await auth.api.getSession({ headers: request.headers });
		if (authSession) {
			session = {
				...authSession,
				session: {
					...authSession.session,
					ipAddress: authSession.session.ipAddress ?? null,
					userAgent: authSession.session.userAgent ?? null,
				},
			};
		}
	})();

	const handler = new RPCHandler(appRouter);

	// Create a proxy that calls the handler directly
	return new Proxy({} as typeof appRouter, {
		get(_target, prop: string) {
			const router = appRouter[prop as keyof typeof appRouter];
			if (!router) return undefined;

			// Return a proxy for the router that handles procedure calls
			return new Proxy({} as any, {
				get(_target, procedureName: string) {
					return async (input?: any) => {
						// Ensure session is loaded
						if (!session) {
							const authSession = await auth.api.getSession({
								headers: request.headers,
							});
							if (authSession) {
								session = {
									...authSession,
									session: {
										...authSession.session,
										ipAddress: authSession.session.ipAddress ?? null,
										userAgent: authSession.session.userAgent ?? null,
									},
								};
							}
						}

						// Create a mock request for the handler
						const mockRequest = new Request("http://localhost/api/orpc", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								method: "call",
								path: `/${prop}/${procedureName}`,
								input,
							}),
						});

						const { response } = await handler.handle(mockRequest, {
							prefix: "/api/orpc",
							context: {
								env,
								db,
								auth,
								session,
							},
						});

						const data = await response.json();
						return data.result;
					};
				},
			});
		},
	});
}


