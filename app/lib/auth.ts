import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { ADMIN_USER_IDS } from "../config/constants";
import { getDb } from "./db";
import * as schema from "./schema";

// biome-ignore lint/suspicious/noExplicitAny: types for Cloudflare and Drizzle can be inconsistent across environments
export const createAuth = (env?: CloudflareBindings, cf?: any) => {
	const db = env
		? getDb(env.DB)
		: // biome-ignore lint/suspicious/noExplicitAny: CLI usage requires empty object
			({} as any);

	const usePlural = true;
	const debugLogs = false;

	return betterAuth({
		...withCloudflare(
			{
				autoDetectIpAddress: true,
				geolocationTracking: true,
				cf: cf || {},
				d1: env
					? {
							db,
							options: {
								usePlural,
								debugLogs,
							},
						}
					: undefined,
				kv: env ? env.KV : undefined,
			},
			{
				secret: env?.BETTER_AUTH_SECRET,
				socialProviders: env
					? {
							google: {
								clientId: env.GOOGLE_CLIENT_ID as string,
								clientSecret: env.GOOGLE_CLIENT_SECRET as string,
							},
						}
					: {},
				plugins: [
					admin({
						// defaultRole: "user",
						// adminRole: "admin"
						adminUserIds: ADMIN_USER_IDS,
					}),
				],
				advanced: {
					defaultCookieAttributes: {
						sameSite: "none",
						secure: true,
					},
				},
				user: {
					additionalFields: {
						role: {
							type: "string",
							defaultValue: "user",
						},
					},
				},
			},
		),
		// Only add database adapter for CLI schema generation
		...(env
			? {}
			: {
					// biome-ignore lint/suspicious/noExplicitAny: performance
					database: drizzleAdapter({} as any, {
						provider: "sqlite",
						usePlural,
						debugLogs,
					}),
				}),
	});
};

export type Auth = ReturnType<typeof createAuth>;

// Export for CLI schema generation
export const auth = createAuth();
