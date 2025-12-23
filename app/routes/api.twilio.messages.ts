import { createAuth } from "~/lib/auth";
import {
	createServiceConversationMessage,
	listServiceConversationMessage,
} from "~/lib/twilio/conversation-api";
import type { Route } from "./+types/api.twilio.messages";

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
		console.error("Missing Twilio API credentials:", {
			hasApiKey: !!env.TWILIO_API_KEY,
			hasApiSecret: !!env.TWILIO_API_SECRET,
			hasAccountSid: !!env.TWILIO_ACCOUNT_SID,
		});
		throw new Error("TWILIO_API_KEY and TWILIO_API_SECRET are required");
	}
	const auth = btoa(`${env.TWILIO_API_KEY}:${env.TWILIO_API_SECRET}`);
	return {
		Authorization: `Basic ${auth}`,
	};
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env as CloudflareBindings;
	const auth = createAuth(env);
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const url = new URL(request.url);
	const conversationSid = url.searchParams.get("conversationSid");

	if (!conversationSid) {
		return Response.json({ error: "conversationSid is required" }, {
			status: 400,
		});
	}

	const headers = getTwilioAuthHeaders(env);

	try {
		const response = await listServiceConversationMessage(
			env.TWILIO_SERVICE_SID,
			conversationSid,
			undefined,
			{ headers },
		);

		return Response.json({
			messages: (response.data.messages || []).map((msg) => ({
				sid: msg.sid,
				index: msg.index,
				author: msg.author,
				body: msg.body,
				dateCreated: msg.dateCreated,
				dateUpdated: msg.dateUpdated,
				attributes: msg.attributes,
			})),
		});
	} catch (error) {
		console.error("Error fetching messages:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env as CloudflareBindings;
	const auth = createAuth(env);
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const headers = getTwilioAuthHeaders(env);

	let body;
	try {
		body = await request.json();
	} catch (error) {
		return Response.json(
			{ error: "Invalid JSON in request body" },
			{ status: 400 },
		);
	}

	const { conversationSid, message } = body;

	if (!conversationSid || !message || typeof conversationSid !== "string" || typeof message !== "string") {
		return Response.json(
			{ 
				error: "conversationSid and message are required",
				received: { conversationSid: conversationSid ?? null, message: message ?? null }
			},
			{ status: 400 },
		);
	}

	try {
		const response = await createServiceConversationMessage(
			env.TWILIO_SERVICE_SID,
			conversationSid,
			{
				Author: session.user.email,
				Body: message,
			},
			{ headers },
		);

		return Response.json({
			sid: response.data.sid,
			index: response.data.index,
			author: response.data.author,
			body: response.data.body,
			dateCreated: response.data.dateCreated,
			dateUpdated: response.data.dateUpdated,
			attributes: response.data.attributes,
		});
	} catch (error) {
		console.error("Error sending message:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}
