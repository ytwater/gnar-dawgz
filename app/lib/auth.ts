import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer, phoneNumber } from "better-auth/plugins";
import {
	ADMIN_USER_IDS,
	TWILIO_WHATSAPP_NUMBER,
	TWILIO_WHATSAPP_OTP_TEMPLATE_SID,
} from "../config/constants";
import { getDb } from "./db";
import {
	type CreateMessageBody,
	createMessage,
} from "./twilio/classic-messages-api";

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
				// socialProviders: env
				// 	? {
				// 			google: {
				// 				clientId: env.GOOGLE_CLIENT_ID as string,
				// 				clientSecret: env.GOOGLE_CLIENT_SECRET as string,
				// 			},
				// 		}
				// 	: {},
				plugins: [
					bearer({
						// Enable bearer token authentication for 3rd party websites
						// Tokens are sent in Authorization: Bearer <token> header
					}),
					phoneNumber({
						sendOTP: async ({ phoneNumber, code }, ctx) => {
							console.log(
								"🚀 ~ auth.ts:50 ~ createAuth ~ phoneNumber:",
								phoneNumber,
							);
							if (!env) return;
							// const db = getDb(env.DB);
							// const authenticatingUser = await db.select().from(users).where(eq(users., phoneNumber));

							const createMessagePayload: CreateMessageBody = {
								From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
								To: `whatsapp:${phoneNumber}`,
								ContentSid: TWILIO_WHATSAPP_OTP_TEMPLATE_SID,
								ContentVariables: JSON.stringify({
									"1": code, // correct
								}),
							};
							console.log(
								"🚀 ~ auth.ts:74 ~ createAuth ~ createMessagePayload:",
								createMessagePayload,
							);
							const results = await createMessage(env, createMessagePayload);
							console.log("🚀 ~ auth.ts:75 ~ createAuth ~ results:", results);
						},
						// We do not support sign-up with phone number.
						// The users will onboard via whatsapp chat.
						// signUpOnVerification: {
						// 	getTempEmail: (phoneNumber) => {
						// 		return `${phoneNumber.replace(/\D/g, "")}@gnar-dawgs.temp`;
						// 	},
						// 	getTempName: (phoneNumber) => {
						// 		return phoneNumber;
						// 	},
						// },
					}),
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
						// whatsappNumber: {
						// 	type: "string",
						// 	defaultValue: "",
						// },
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
