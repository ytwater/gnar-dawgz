import {
	ADMIN_USER_IDS,
	MAIN_CONVERSATION_UNIQUE_NAME,
	TWILIO_WHATSAPP_NUMBER,
} from "~/config/constants";
import { createAuth } from "~/lib/auth";
import {
	createServiceConversationParticipant,
	deleteServiceConversationParticipant,
	fetchServiceConversation,
	listServiceConversationParticipant,
} from "~/lib/twilio/conversation-api";
import type { Route } from "./+types/api.whatsapp.add-participant";

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

	let body: { phoneNumber?: unknown; proxyAddress?: unknown };
	try {
		body = await request.json();
	} catch (error) {
		return Response.json(
			{ error: "Invalid JSON in request body" },
			{ status: 400 },
		);
	}

	const { phoneNumber } = body;

	const proxyAddress = TWILIO_WHATSAPP_NUMBER;

	if (!phoneNumber || typeof phoneNumber !== "string") {
		return Response.json(
			{ error: "phoneNumber is required and must be a string" },
			{ status: 400 },
		);
	}

	const isWhatsappNumber = phoneNumber.startsWith("whatsapp:");

	// Normalize phone number format (ensure it starts with whatsapp:)
	const normalizedPhoneNumber = phoneNumber;
	// const normalizedPhoneNumber = phoneNumber.startsWith("whatsapp:")
	// 	? phoneNumber
	// 	: `whatsapp:${phoneNumber}`;

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
		console.log(
			"🚀 ~ api.whatsapp.add-participant.ts:95 ~ action ~ conversationResponse:",
			conversationResponse,
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

		// Check if participant already exists
		// const participantsResponse = await listServiceConversationParticipant(
		// 	serviceSid,
		// 	conversationSid,
		// 	undefined,
		// 	{ headers },
		// );
		// console.log(
		// 	"🚀 ~ api.whatsapp.add-participant.ts:124 ~ action ~ participantsResponse:",
		// 	participantsResponse,
		// );

		// const participants = participantsResponse.data.participants || [];

		// // Try to get proxy address from existing WhatsApp participants or env var
		// let resolvedProxyAddress = proxyAddress;

		// if (!resolvedProxyAddress || typeof resolvedProxyAddress !== "string") {
		// 	// Try to find it from existing WhatsApp participants
		// 	for (const participant of participants) {
		// 		const binding = (participant as { messaging_binding?: unknown })
		// 			?.messaging_binding;
		// 		if (binding && typeof binding === "object" && binding !== null) {
		// 			const address =
		// 				(binding as { address?: string })?.address ||
		// 				(binding as { Address?: string })?.Address;
		// 			const proxy =
		// 				(binding as { proxy_address?: string })?.proxy_address ||
		// 				(binding as { ProxyAddress?: string })?.ProxyAddress;

		// 			// If this is a WhatsApp participant, use its proxy address
		// 			if (address?.startsWith("whatsapp:") && proxy) {
		// 				resolvedProxyAddress = proxy;
		// 				break;
		// 			}
		// 		}
		// 	}

		// 	// If still not found, try environment variable
		// 	if (!resolvedProxyAddress) {
		// 		const envWithWhatsapp = env as { TWILIO_WHATSAPP_NUMBER?: string };
		// 		resolvedProxyAddress = envWithWhatsapp.TWILIO_WHATSAPP_NUMBER;
		// 	}

		// 	// If still not found, use the constant as fallback
		// 	if (!resolvedProxyAddress) {
		// 		resolvedProxyAddress = TWILIO_WHATSAPP_NUMBER;
		// 	}
		// }

		// // Proxy address is required for WhatsApp participants
		// if (!resolvedProxyAddress || typeof resolvedProxyAddress !== "string") {
		// 	return Response.json(
		// 		{
		// 			error:
		// 				"Proxy address (Twilio WhatsApp number) is required. Please provide it or configure TWILIO_WHATSAPP_NUMBER environment variable.",
		// 		},
		// 		{ status: 400 },
		// 	);
		// }

		// Normalize proxy address format
		const normalizedProxyAddress = isWhatsappNumber
			? `whatsapp:${proxyAddress}`
			: proxyAddress;

		// Check if participant with this address AND proxy address already exists
		// (Twilio uses the combination of address + proxy address as unique identifier)
		// const existingParticipantWithProxy = participants.find((p) => {
		// 	const binding = (p as { messaging_binding?: unknown })?.messaging_binding;
		// 	if (binding && typeof binding === "object" && binding !== null) {
		// 		const address =
		// 			(binding as { address?: string })?.address ||
		// 			(binding as { Address?: string })?.Address;
		// 		const proxy =
		// 			(binding as { proxy_address?: string })?.proxy_address ||
		// 			(binding as { ProxyAddress?: string })?.ProxyAddress;

		// 		// Normalize both for comparison
		// 		const normalizedExistingAddress = address;
		// 		// const normalizedExistingAddress = address?.startsWith("whatsapp:")
		// 		// 	? address
		// 		// 	: address
		// 		// 		? `whatsapp:${address}`
		// 		// 		: null;
		// 		const normalizedExistingProxy = proxy?.startsWith("whatsapp:")
		// 			? proxy
		// 			: proxy
		// 				? `whatsapp:${proxy}`
		// 				: null;

		// 		return (
		// 			normalizedExistingAddress === normalizedPhoneNumber &&
		// 			normalizedExistingProxy === normalizedProxyAddress
		// 		);
		// 	}
		// 	return false;
		// });

		// if (existingParticipantWithProxy) {
		// 	return Response.json(
		// 		{
		// 			error:
		// 				"This WhatsApp number is already a participant in this conversation",
		// 		},
		// 		{ status: 409 },
		// 	);
		// }

		// Add the WhatsApp number as a participant
		const participantBody: {
			"MessagingBinding.Address": string;
			"MessagingBinding.ProxyAddress": string;
		} = {
			"MessagingBinding.Address": normalizedPhoneNumber,
			"MessagingBinding.ProxyAddress": normalizedProxyAddress,
		};
		console.log("serviceSid", serviceSid);
		console.log("conversationSid", conversationSid);
		console.log(
			"🚀 ~ api.whatsapp.add-participant.ts:219 ~ action ~ participantBody:",
			participantBody,
		);

		// const removeResponse = await deleteServiceConversationParticipant(
		// 	serviceSid,
		// 	conversationSid,
		// 	normalizedPhoneNumber,
		// 	{ headers },
		// );

		const addResponse = await createServiceConversationParticipant(
			serviceSid,
			conversationSid,
			participantBody,
			{ headers },
		);
		console.log(
			"🚀 ~ api.whatsapp.add-participant.ts:230 ~ action ~ addResponse:",
			addResponse,
		);

		if (addResponse.status !== 201) {
			const errorMessage =
				addResponse.data &&
				typeof addResponse.data === "object" &&
				"message" in addResponse.data
					? String(addResponse.data.message)
					: "Failed to add participant";
			return Response.json(
				{ error: errorMessage },
				{ status: addResponse.status },
			);
		}

		const response = Response.json({
			success: true,
			message: `Number ${normalizedPhoneNumber} added successfully. Note: The user must message your WhatsApp number first, or you must send them a pre-approved template message to enable messaging.`,
			participant: addResponse.data,
		});
		console.log(
			"🚀 ~ api.whatsapp.add-participant.ts:253 ~ action ~ response:",
			response,
		);
		return response;
	} catch (error) {
		console.error("Error adding WhatsApp participant:", error);
		return Response.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to add participant",
			},
			{ status: 500 },
		);
	}
}
