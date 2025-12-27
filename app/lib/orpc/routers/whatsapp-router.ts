import { z } from "zod";
import {
	ADMIN_USER_IDS,
	MAIN_CONVERSATION_UNIQUE_NAME,
	TWILIO_WHATSAPP_NUMBER,
} from "~/app/config/constants";
import {
	createServiceConversationParticipant,
	deleteServiceConversationParticipant,
	fetchServiceConversation,
	listServiceConversationParticipant,
} from "~/app/lib/twilio/conversation-api";
import { authedProcedure, publicProcedure } from "../server";

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

export const whatsappRouter = {
	addParticipant: authedProcedure
		.input(
			z.object({
				phoneNumber: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env, session } = context;
			const { phoneNumber } = input;

			// Check if user is admin
			const user = session.user as { id: string; role?: string };
			const isAdmin = user.role === "admin" || ADMIN_USER_IDS.includes(user.id);
			if (!isAdmin) {
				throw new Error("Forbidden: Admin access required");
			}

			const proxyAddress = TWILIO_WHATSAPP_NUMBER;
			const isWhatsappNumber = phoneNumber.startsWith("whatsapp:");
			const normalizedPhoneNumber = phoneNumber;
			const normalizedProxyAddress = isWhatsappNumber
				? `whatsapp:${proxyAddress}`
				: proxyAddress;

			const headers = getTwilioAuthHeaders(env);
			const serviceSid = env.TWILIO_SERVICE_SID;
			if (!serviceSid) {
				throw new Error("TWILIO_SERVICE_SID not configured");
			}

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
				throw new Error("Failed to fetch conversation");
			}

			const conversationSid = conversationResponse.data.sid;

			// Add the WhatsApp number as a participant
			const participantBody: {
				"MessagingBinding.Address": string;
				"MessagingBinding.ProxyAddress": string;
			} = {
				"MessagingBinding.Address": normalizedPhoneNumber,
				"MessagingBinding.ProxyAddress": normalizedProxyAddress,
			};

			const addResponse = await createServiceConversationParticipant(
				serviceSid,
				conversationSid,
				participantBody,
				{ headers },
			);

			if (addResponse.status !== 201) {
				const errorMessage =
					addResponse.data &&
					typeof addResponse.data === "object" &&
					"message" in addResponse.data
						? String((addResponse.data as any).message)
						: "Failed to add participant";
				throw new Error(errorMessage);
			}

			return {
				success: true,
				message: `Number ${normalizedPhoneNumber} added successfully.`,
				participant: addResponse.data,
			};
		}),

	listParticipants: authedProcedure.handler(async ({ context }) => {
		const { env, session } = context;

		// Check if user is admin
		const user = session.user as { id: string; role?: string };
		const isAdmin = user.role === "admin" || ADMIN_USER_IDS.includes(user.id);
		if (!isAdmin) {
			throw new Error("Forbidden: Admin access required");
		}

		const headers = getTwilioAuthHeaders(env);
		const serviceSid = env.TWILIO_SERVICE_SID;
		if (!serviceSid) {
			throw new Error("TWILIO_SERVICE_SID not configured");
		}

		const conversationResponse = await fetchServiceConversation(
			serviceSid,
			MAIN_CONVERSATION_UNIQUE_NAME,
			{ headers },
		);

		if (
			conversationResponse.status !== 200 ||
			!conversationResponse.data?.sid
		) {
			throw new Error("Failed to fetch conversation");
		}

		const conversationSid = conversationResponse.data.sid;

		const participantsResponse = await listServiceConversationParticipant(
			serviceSid,
			conversationSid,
			undefined,
			{ headers },
		);

		const participants = participantsResponse.data.participants || [];

		return {
			success: true,
			participants: participants.map((p) => {
				const binding = (p as any)?.messaging_binding;
				return {
					sid: (p as any)?.sid || "",
					identity: (p as any)?.identity || null,
					address: binding?.address || binding?.Address || "",
					proxyAddress: binding?.proxy_address || binding?.ProxyAddress || "",
				};
			}),
		};
	}),

	removeParticipant: authedProcedure
		.input(
			z.object({
				participantSid: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env, session } = context;

			// Check if user is admin
			const user = session.user as { id: string; role?: string };
			const isAdmin = user.role === "admin" || ADMIN_USER_IDS.includes(user.id);
			if (!isAdmin) {
				throw new Error("Forbidden: Admin access required");
			}

			const headers = getTwilioAuthHeaders(env);
			const serviceSid = env.TWILIO_SERVICE_SID;
			if (!serviceSid) {
				throw new Error("TWILIO_SERVICE_SID not configured");
			}

			const conversationResponse = await fetchServiceConversation(
				serviceSid,
				MAIN_CONVERSATION_UNIQUE_NAME,
				{ headers },
			);

			if (
				conversationResponse.status !== 200 ||
				!conversationResponse.data?.sid
			) {
				throw new Error("Failed to fetch conversation");
			}

			const conversationSid = conversationResponse.data.sid;

			const deleteResponse = await deleteServiceConversationParticipant(
				serviceSid,
				conversationSid,
				input.participantSid,
				{ headers },
			);

			if (deleteResponse.status !== 204 && deleteResponse.status !== 200) {
				throw new Error("Failed to remove participant");
			}

			return { success: true, message: "Participant removed successfully" };
		}),

	send: authedProcedure
		.input(
			z.object({
				conversationSid: z.string(),
				message: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env, session } = context;
			const { conversationSid, message } = input;

			// Get the Durable Object stub
			const id = env.Whatsapp.idFromName(`twilioConv:${conversationSid}`);
			const stub = env.Whatsapp.get(id);

			// Forward the request to the DO
			const doResponse = await stub.fetch("http://do/send", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-User-Email": session.user.email || "unknown",
				},
				body: JSON.stringify({ conversationSid, message }),
			});

			return doResponse.json();
		}),
};
