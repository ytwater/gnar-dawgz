import { createAuth } from "~/lib/auth";
import {
	createServiceConversation,
	fetchServiceConversation,
	listServiceConversation,
} from "~/lib/twilio/conversation-api";
import type { Route } from "./+types/api.twilio.conversations";

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
	const uniqueName = url.searchParams.get("uniqueName");
	const headers = getTwilioAuthHeaders(env);

	try {
		if (conversationSid || uniqueName) {
			// Get a specific conversation by SID or uniqueName
			const identifier = conversationSid || uniqueName;
			if (!identifier) {
				return Response.json({ error: "conversationSid or uniqueName required" }, { status: 400 });
			}
			const response = await fetchServiceConversation(
				env.TWILIO_SERVICE_SID,
				identifier, // Twilio allows using uniqueName in place of Sid
				{ headers },
			);
			return Response.json(response.data);
		} else {
			// List all conversations for the service
			const response = await listServiceConversation(
				env.TWILIO_SERVICE_SID,
				undefined,
				{ headers },
			);
			const conversations = (response.data.conversations || []).map((conv) => {
				if (!conv.sid) {
					console.warn("Conversation missing sid:", conv);
				}
				return {
					sid: conv.sid,
					friendlyName: conv.friendlyName,
					uniqueName: conv.uniqueName,
					dateCreated: conv.dateCreated,
					dateUpdated: conv.dateUpdated,
					state: conv.state,
					attributes: conv.attributes,
				};
			});
			return Response.json({ conversations });
		}
	} catch (error) {
		console.error("Error fetching conversations:", error);
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

	try {
		const body = await request.json();
		const { friendlyName, uniqueName } = body;

		if (!env.TWILIO_SERVICE_SID) {
			throw new Error("TWILIO_SERVICE_SID is not configured");
		}

		const response = await createServiceConversation(
			env.TWILIO_SERVICE_SID,
			{
				FriendlyName: friendlyName,
				UniqueName: uniqueName,
			},
			{ headers },
		);

		// Handle 409 Conflict - conversation already exists
		if (response.status === 409 && uniqueName) {
			// Fetch the existing conversation by uniqueName directly
			try {
				const fetchResponse = await fetchServiceConversation(
					env.TWILIO_SERVICE_SID,
					uniqueName, // Twilio allows using uniqueName in place of Sid
					{ headers },
				);
				
				if (fetchResponse.status === 200 && fetchResponse.data?.sid) {
					return Response.json({
						conversation: {
							sid: fetchResponse.data.sid,
							friendlyName: fetchResponse.data.friendlyName,
							uniqueName: fetchResponse.data.uniqueName,
							dateCreated: fetchResponse.data.dateCreated,
							dateUpdated: fetchResponse.data.dateUpdated,
							state: fetchResponse.data.state,
							attributes: fetchResponse.data.attributes,
						},
					});
				}
			} catch (fetchError) {
				console.error("Error fetching existing conversation by uniqueName:", fetchError);
				// Fall through to error handling below
			}
		}

		if (response.status !== 201) {
			let errorMessage = `HTTP ${response.status}`;
			if (response.data && typeof response.data === 'object') {
				const errorData = response.data as any;
				errorMessage = errorData.message || errorData.error || JSON.stringify(response.data);
			}
			console.error("Twilio API error:", {
				status: response.status,
				data: response.data,
				serviceSid: env.TWILIO_SERVICE_SID ? `${env.TWILIO_SERVICE_SID.substring(0, 4)}...` : 'missing',
				hasApiKey: !!env.TWILIO_API_KEY,
				hasApiSecret: !!env.TWILIO_API_SECRET,
				apiKeyPrefix: env.TWILIO_API_KEY ? env.TWILIO_API_KEY.substring(0, 2) : 'none',
			});
			throw new Error(`Twilio API error (${response.status}): ${errorMessage}`);
		}

		if (!response.data?.sid) {
			console.error("Twilio response missing sid:", response);
			throw new Error(`Twilio API did not return a valid conversation sid. Status: ${response.status}`);
		}

		return Response.json({
			conversation: {
				sid: response.data.sid,
				friendlyName: response.data.friendlyName,
				uniqueName: response.data.uniqueName,
				dateCreated: response.data.dateCreated,
				dateUpdated: response.data.dateUpdated,
				state: response.data.state,
				attributes: response.data.attributes,
			},
		});
	} catch (error) {
		console.error("Error creating conversation:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}
