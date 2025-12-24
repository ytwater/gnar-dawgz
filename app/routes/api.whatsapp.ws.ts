import { createAuth } from "~/lib/auth";
import { fetchServiceConversation } from "~/lib/twilio/conversation-api";
import type { Route } from "./+types/api.whatsapp.ws";

function getTwilioAuthHeaders(env: CloudflareBindings): HeadersInit {
	const envWithToken = env as { TWILIO_AUTH_TOKEN?: string };
	if (envWithToken.TWILIO_AUTH_TOKEN) {
		const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${envWithToken.TWILIO_AUTH_TOKEN}`);
		return {
			Authorization: `Basic ${auth}`,
		};
	}
	if (!env.TWILIO_API_KEY || !env.TWILIO_API_SECRET) {
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
	const uniqueName = url.searchParams.get("uniqueName");
	const conversationSid = url.searchParams.get("conversationSid");

	let resolvedConversationSid = conversationSid;

	// If uniqueName is provided, resolve it to conversationSid
	if (!resolvedConversationSid && uniqueName) {
		if (!env.TWILIO_SERVICE_SID) {
			return new Response("TWILIO_SERVICE_SID not configured", { status: 500 });
		}

		try {
			const headers = getTwilioAuthHeaders(env);
			const response = await fetchServiceConversation(
				env.TWILIO_SERVICE_SID,
				uniqueName,
				{ headers },
			);

			if (response.status !== 200 || !response.data?.sid) {
				return new Response(
					`Failed to fetch conversation: ${response.status}`,
					{ status: response.status },
				);
			}

			resolvedConversationSid = response.data.sid;
		} catch (error) {
			console.error("Error fetching conversation:", error);
			return new Response(
				error instanceof Error ? error.message : "Failed to fetch conversation",
				{ status: 500 },
			);
		}
	}

	if (!resolvedConversationSid) {
		return new Response("conversationSid or uniqueName required", { status: 400 });
	}

	// Get the Durable Object stub
	const id = env.Whatsapp.idFromName(`twilioConv:${resolvedConversationSid}`);
	const stub = env.Whatsapp.get(id);

	// Forward the WebSocket upgrade request to the DO
	const doUrl = new URL(request.url);
	doUrl.pathname = "/ws";
	doUrl.searchParams.set("conversationSid", resolvedConversationSid);

	const doRequest = new Request(doUrl.toString(), {
		method: request.method,
		headers: request.headers,
	});

	return stub.fetch(doRequest);
}

