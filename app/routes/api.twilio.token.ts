import { MAIN_CONVERSATION_UNIQUE_NAME } from "~/config/constants";
import { createAuth } from "~/lib/auth";
import {
	createServiceConversation,
	createServiceConversationParticipant,
	fetchServiceConversation,
	listServiceConversationParticipant,
} from "~/lib/twilio/conversation-api";
import type { Route } from "./+types/api.twilio.token";
import { createTwilioAccessTokenJwt } from "~/lib/twilio/access-token";

function getTwilioAuthHeaders(env: CloudflareBindings): HeadersInit {
	const envWithToken = env as { TWILIO_AUTH_TOKEN?: string };
	if (envWithToken.TWILIO_AUTH_TOKEN) {
		// Use Account SID + Auth Token
		const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${envWithToken.TWILIO_AUTH_TOKEN}`);
		return {
			Authorization: `Basic ${auth}`,
		};
	}
	// Use API Key SID + API Secret
	if (!env.TWILIO_API_KEY || !env.TWILIO_API_SECRET) {
		throw new Error("TWILIO_API_KEY and TWILIO_API_SECRET are required");
	}
	const auth = btoa(`${env.TWILIO_API_KEY}:${env.TWILIO_API_SECRET}`);
	return {
		Authorization: `Basic ${auth}`,
	};
}

async function ensureConversationAndParticipant(
	env: CloudflareBindings,
	userIdentity: string,
): Promise<void> {
	const headers = getTwilioAuthHeaders(env);
	const serviceSid = env.TWILIO_SERVICE_SID;

	if (!serviceSid) {
		throw new Error("TWILIO_SERVICE_SID is required");
	}

	// Try to fetch the conversation by unique name
	let conversationSid: string | undefined;
	try {
		const response = await fetchServiceConversation(
			serviceSid,
			MAIN_CONVERSATION_UNIQUE_NAME, // Twilio allows using uniqueName in place of Sid
			{ headers },
		);
		conversationSid = response.data.sid;
		console.log("Found existing conversation:", conversationSid);
	} catch (error) {
		// Conversation doesn't exist, create it
		console.log("Conversation not found, creating new one");
		try {
			const response = await createServiceConversation(
				serviceSid,
				{
					UniqueName: MAIN_CONVERSATION_UNIQUE_NAME,
					FriendlyName: "Main Conversation",
				},
				{ headers },
			);
			conversationSid = response.data.sid;
			console.log("Created new conversation:", conversationSid);
		} catch (createError) {
			const errorMessage =
				createError instanceof Error ? createError.message : String(createError);
			// If conflict, conversation was created between fetch and create, try to fetch again
			if (errorMessage.includes("Conflict") || errorMessage.includes("50300")) {
				const retryResponse = await fetchServiceConversation(
					serviceSid,
					MAIN_CONVERSATION_UNIQUE_NAME,
					{ headers },
				);
				conversationSid = retryResponse.data.sid;
				console.log("Retrieved conversation after conflict:", conversationSid);
			} else {
				throw createError;
			}
		}
	}

	if (!conversationSid) {
		throw new Error("Failed to get or create conversation");
	}

	// Check if user is already a participant
	try {
		const participantsResponse = await listServiceConversationParticipant(
			serviceSid,
			conversationSid,
			undefined,
			{ headers },
		);
		const participants = participantsResponse.data.participants || [];
		const isParticipant = participants.some(
			(p) => p.identity === userIdentity,
		);

		if (!isParticipant) {
			// Add user as participant
			console.log("Adding user as participant:", userIdentity);
			await createServiceConversationParticipant(
				serviceSid,
				conversationSid,
				{
					Identity: userIdentity,
				},
				{ headers },
			);
			console.log("User added as participant");
		} else {
			console.log("User is already a participant");
		}
	} catch (error) {
		console.error("Error checking/adding participant:", error);
		// Don't fail token generation if participant check/add fails
		// The user might still be able to connect
	}
}

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

	const userIdentity = session.user.email;

	try {
		// Ensure conversation exists and user is a participant
		await ensureConversationAndParticipant(env, userIdentity);

		// Generate and return the token
		const token = await createTwilioAccessTokenJwt({
			accountSid: env.TWILIO_ACCOUNT_SID,
			apiKeySid: env.TWILIO_API_KEY,
			apiKeySecret: env.TWILIO_API_SECRET,
			options: {
				identity: userIdentity,
				serviceSid: env.TWILIO_SERVICE_SID,
			},
		});

		return Response.json({ token });
	} catch (error) {
		console.error("Error generating token:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Failed to generate token" },
			{ status: 500 },
		);
	}
}

