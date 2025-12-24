import {
	ADMIN_USER_IDS,
	MAIN_CONVERSATION_UNIQUE_NAME,
} from "~/config/constants";
import { createAuth } from "~/lib/auth";
import {
	deleteServiceConversationParticipant,
	fetchServiceConversation,
	listServiceConversationParticipant,
} from "~/lib/twilio/conversation-api";
import type { Route } from "./+types/api.whatsapp.participants";

function getTwilioAuthHeaders(env: CloudflareBindings): HeadersInit {
	const envWithToken = env as { TWILIO_AUTH_TOKEN?: string };
	if (envWithToken.TWILIO_AUTH_TOKEN) {
		const auth = btoa(
			`${env.TWILIO_ACCOUNT_SID}:${envWithToken.TWILIO_AUTH_TOKEN}`,
		);
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
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Check if user is admin
	const user = session.user as { id: string; role?: string };
	const isAdmin = user.role === "admin" || ADMIN_USER_IDS.includes(user.id);

	if (!isAdmin) {
		return Response.json(
			{ error: "Forbidden: Admin access required" },
			{ status: 403 },
		);
	}

	const headers = getTwilioAuthHeaders(env);
	const serviceSid = env.TWILIO_SERVICE_SID;

	if (!serviceSid) {
		return Response.json(
			{ error: "TWILIO_SERVICE_SID not configured" },
			{ status: 500 },
		);
	}

	try {
		// Get the conversation
		const conversationResponse = await fetchServiceConversation(
			serviceSid,
			MAIN_CONVERSATION_UNIQUE_NAME,
			{ headers },
		);

		if (
			conversationResponse.status !== 200 ||
			!conversationResponse.data?.sid
		) {
			return Response.json(
				{ error: "Failed to fetch conversation" },
				{ status: conversationResponse.status },
			);
		}

		const conversationSid = conversationResponse.data.sid;

		// List all participants
		const participantsResponse = await listServiceConversationParticipant(
			serviceSid,
			conversationSid,
			undefined,
			{ headers },
		);

		const participants = participantsResponse.data.participants || [];

		// Format participants for easier consumption
		const formattedParticipants = participants.map((p) => {
			const binding = (p as { messaging_binding?: unknown })
				?.messaging_binding;
			let address = "";
			let proxyAddress = "";

			if (binding && typeof binding === "object" && binding !== null) {
				address =
					(binding as { address?: string })?.address ||
					(binding as { Address?: string })?.Address ||
					"";
				proxyAddress =
					(binding as { proxy_address?: string })?.proxy_address ||
					(binding as { ProxyAddress?: string })?.ProxyAddress ||
					"";
			}

			return {
				sid: (p as { sid?: string })?.sid || "",
				identity: (p as { identity?: string })?.identity || null,
				address,
				proxyAddress,
			};
		});

		return Response.json({
			success: true,
			participants: formattedParticipants,
		});
	} catch (error) {
		console.error("Error listing WhatsApp participants:", error);
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to list participants",
			},
			{ status: 500 },
		);
	}
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env as CloudflareBindings;
	const auth = createAuth(env);
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Check if user is admin
	const user = session.user as { id: string; role?: string };
	const isAdmin = user.role === "admin" || ADMIN_USER_IDS.includes(user.id);

	if (!isAdmin) {
		return Response.json(
			{ error: "Forbidden: Admin access required" },
			{ status: 403 },
		);
	}

	let body: { participantSid?: unknown };
	try {
		body = await request.json();
	} catch (error) {
		return Response.json(
			{ error: "Invalid JSON in request body" },
			{ status: 400 },
		);
	}

	const { participantSid } = body;

	if (!participantSid || typeof participantSid !== "string") {
		return Response.json(
			{ error: "participantSid is required and must be a string" },
			{ status: 400 },
		);
	}

	const headers = getTwilioAuthHeaders(env);
	const serviceSid = env.TWILIO_SERVICE_SID;

	if (!serviceSid) {
		return Response.json(
			{ error: "TWILIO_SERVICE_SID not configured" },
			{ status: 500 },
		);
	}

	try {
		// Get the conversation
		const conversationResponse = await fetchServiceConversation(
			serviceSid,
			MAIN_CONVERSATION_UNIQUE_NAME,
			{ headers },
		);

		if (
			conversationResponse.status !== 200 ||
			!conversationResponse.data?.sid
		) {
			return Response.json(
				{ error: "Failed to fetch conversation" },
				{ status: conversationResponse.status },
			);
		}

		const conversationSid = conversationResponse.data.sid;

		// Delete the participant
		const deleteResponse = await deleteServiceConversationParticipant(
			serviceSid,
			conversationSid,
			participantSid,
			{ headers },
		);

		if (deleteResponse.status !== 204 && deleteResponse.status !== 200) {
			const errorMessage =
				deleteResponse.data &&
				typeof deleteResponse.data === "object" &&
				"message" in deleteResponse.data
					? String(deleteResponse.data.message)
					: "Failed to remove participant";
			return Response.json(
				{ error: errorMessage },
				{ status: deleteResponse.status },
			);
		}

		return Response.json({
			success: true,
			message: "Participant removed successfully",
		});
	} catch (error) {
		console.error("Error removing WhatsApp participant:", error);
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to remove participant",
			},
			{ status: 500 },
		);
	}
}

