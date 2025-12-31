import { createAuth } from "~/app/lib/auth";
import { getDb } from "~/app/lib/db";
import type { ORPCContext } from "./server";

export async function createORPCContext(
	env: CloudflareBindings,
	request: Request,
): Promise<ORPCContext> {
	const auth = createAuth(env, (request as any).cf);
	const db = getDb(env.DB);
	const session = await auth.api.getSession({ headers: request.headers });

	return {
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
	};
}

