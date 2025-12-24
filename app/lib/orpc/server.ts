import { os } from "@orpc/server";
import { z } from "zod";
import { ADMIN_USER_IDS } from "~/config/constants";
import type { Auth } from "~/lib/auth";
import type { getDb } from "~/lib/db";

export interface ORPCContext {
	env: CloudflareBindings;
	db: ReturnType<typeof getDb>;
	auth: Auth;
	session: {
		user: {
			id: string;
			email: string;
			emailVerified: boolean;
			name: string;
			createdAt: Date;
			updatedAt: Date;
			role: string;
		};
		session: {
			id: string;
			userId: string;
			expiresAt: Date;
			token: string;
			createdAt: Date;
			updatedAt: Date;
			ipAddress: string | null;
			userAgent: string | null;
		};
	} | null;
}

export const server = os.$context<ORPCContext>();

export const publicProcedure = server;

const authMiddleware = server.middleware(async ({ context, next }) => {
	if (!context.session?.user?.id) {
		throw new Error("Unauthorized");
	}
	return next({
		context: {
			...context,
			session: context.session,
		},
	});
});

const adminMiddleware = server.middleware(async ({ context, next }) => {
	if (
		!context.session?.user?.id ||
		(context.session.user.role !== "admin" &&
			!ADMIN_USER_IDS.includes(context.session.user.id))
	) {
		throw new Error("Unauthorized");
	}
	return next({
		context: {
			...context,
			session: context.session,
		},
	});
});

export const authedProcedure = server.use(authMiddleware);
export const adminProcedure = server.use(adminMiddleware);
