import { createAuth } from "~/lib/auth";
import twilio from "twilio";
import type { Route } from "./+types/api.twilio.token";

const { AccessToken } = twilio.jwt;
const { ConversationsGrant } = AccessToken;

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env as CloudflareBindings;
	const auth = createAuth(env);
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_API_KEY || !env.TWILIO_API_SECRET || !env.TWILIO_SERVICE_SID) {
		console.error("Missing Twilio credentials:", {
			hasAccountSid: !!env.TWILIO_ACCOUNT_SID,
			hasApiKey: !!env.TWILIO_API_KEY,
			hasApiSecret: !!env.TWILIO_API_SECRET,
			hasServiceSid: !!env.TWILIO_SERVICE_SID,
		});
		return Response.json(
			{ error: "Twilio credentials not configured" },
			{ status: 500 },
		);
	}

	try {
		const token = new AccessToken(
			env.TWILIO_ACCOUNT_SID,
			env.TWILIO_API_KEY,
			env.TWILIO_API_SECRET,
			{ identity: session.user.email },
		);

		const grant = new ConversationsGrant({
			serviceSid: env.TWILIO_SERVICE_SID,
		});
		token.addGrant(grant);

		return Response.json({ token: token.toJwt() });
	} catch (error) {
		console.error("Error generating token:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Failed to generate token" },
			{ status: 500 },
		);
	}
}

