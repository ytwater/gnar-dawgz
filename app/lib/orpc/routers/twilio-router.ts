import { z } from "zod";
import { MAIN_CONVERSATION_UNIQUE_NAME } from "~/app/config/constants";
import { createTwilioAccessTokenJwt } from "~/app/lib/twilio/access-token";
import {
	createServiceConversation,
	createServiceConversationMessage,
	createServiceConversationParticipant,
	deleteServiceConversationMessage,
	fetchServiceConversation,
	listServiceConversation,
	listServiceConversationMessage,
	listServiceConversationParticipant,
} from "~/app/lib/twilio/conversation-api";
import {
	createSubscribedEvent,
	deleteSubscribedEvent,
	fetchSink,
	fetchSubscribedEvent,
	fetchSubscription,
	listSubscribedEvent,
	listSubscription,
	updateSubscribedEvent,
	updateSubscription,
} from "~/app/lib/twilio/events-api";
import { getTwilioAuthHeaders } from "~/app/lib/twilio/getTwilioAuthHeaders";
import { authedProcedure } from "../server";

async function ensureConversationAndParticipant(
	env: CloudflareBindings,
	userIdentity: string,
): Promise<void> {
	const headers = getTwilioAuthHeaders(env);
	const serviceSid = env.TWILIO_SERVICE_SID;

	if (!serviceSid) {
		throw new Error("TWILIO_SERVICE_SID is required");
	}

	let conversationSid: string | null | undefined;
	try {
		const response = await fetchServiceConversation(
			serviceSid,
			MAIN_CONVERSATION_UNIQUE_NAME,
			{ headers },
		);
		conversationSid = response.data.sid;
	} catch (error) {
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
		} catch (createError) {
			const errorMessage =
				createError instanceof Error
					? createError.message
					: String(createError);
			if (errorMessage.includes("Conflict") || errorMessage.includes("50300")) {
				const retryResponse = await fetchServiceConversation(
					serviceSid,
					MAIN_CONVERSATION_UNIQUE_NAME,
					{ headers },
				);
				conversationSid = retryResponse.data.sid;
			} else {
				throw createError;
			}
		}
	}

	if (!conversationSid) {
		throw new Error("Failed to get or create conversation");
	}

	try {
		const participantsResponse = await listServiceConversationParticipant(
			serviceSid,
			conversationSid,
			undefined,
			{ headers },
		);
		const participants = participantsResponse.data.participants || [];
		const isParticipant = participants.some((p) => p.identity === userIdentity);

		if (!isParticipant) {
			await createServiceConversationParticipant(
				serviceSid,
				conversationSid,
				{
					Identity: userIdentity,
				},
				{ headers },
			);
		}
	} catch (error) {
		console.error("Error checking/adding participant:", error);
	}
}

export const twilioRouter = {
	getConversations: authedProcedure
		.input(
			z.object({
				conversationSid: z.string().optional(),
				uniqueName: z.string().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env } = context;
			const { conversationSid, uniqueName } = input;
			const headers = getTwilioAuthHeaders(env);

			if (conversationSid || uniqueName) {
				const identifier = conversationSid || uniqueName;
				const response = await fetchServiceConversation(
					env.TWILIO_SERVICE_SID,
					identifier,
					{ headers },
				);
				return response.data;
			}

			const response = await listServiceConversation(
				env.TWILIO_SERVICE_SID,
				undefined,
				{ headers },
			);
			return {
				conversations: (response.data.conversations || []).map((conv) => ({
					sid: conv.sid,
					friendlyName: conv.friendlyName,
					uniqueName: conv.uniqueName,
					dateCreated: conv.dateCreated,
					dateUpdated: conv.dateUpdated,
					state: conv.state,
					attributes: conv.attributes,
				})),
			};
		}),

	createConversation: authedProcedure
		.input(
			z.object({
				friendlyName: z.string().optional(),
				uniqueName: z.string().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env } = context;
			const { friendlyName, uniqueName } = input;
			const headers = getTwilioAuthHeaders(env);

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

			if (response.status === 409 && uniqueName) {
				const fetchResponse = await fetchServiceConversation(
					env.TWILIO_SERVICE_SID,
					uniqueName,
					{ headers },
				);
				if (fetchResponse.status === 200 && fetchResponse.data?.sid) {
					return { conversation: fetchResponse.data };
				}
			}

			if (response.status !== 201 || !response.data?.sid) {
				throw new Error(`Twilio API error (${response.status})`);
			}

			return { conversation: response.data };
		}),

	getMessages: authedProcedure
		.input(
			z.object({
				conversationSid: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env } = context;
			const headers = getTwilioAuthHeaders(env);
			const response = await listServiceConversationMessage(
				env.TWILIO_SERVICE_SID,
				input.conversationSid,
				undefined,
				{ headers },
			);

			return {
				messages: (response.data.messages || []).map((msg) => ({
					sid: msg.sid,
					index: msg.index,
					author: msg.author,
					body: msg.body,
					dateCreated: msg.dateCreated,
					dateUpdated: msg.dateUpdated,
					attributes: msg.attributes,
				})),
			};
		}),

	sendMessage: authedProcedure
		.input(
			z.object({
				conversationSid: z.string(),
				message: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env, session } = context;
			const headers = getTwilioAuthHeaders(env);
			const response = await createServiceConversationMessage(
				env.TWILIO_SERVICE_SID,
				input.conversationSid,
				{
					Author: session.user.email,
					Body: input.message,
				},
				{ headers },
			);
			return response.data;
		}),

	deleteMessage: authedProcedure
		.input(
			z.object({
				conversationSid: z.string(),
				messageSid: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env } = context;
			const headers = getTwilioAuthHeaders(env);
			const response = await deleteServiceConversationMessage(
				env.TWILIO_SERVICE_SID,
				input.conversationSid,
				input.messageSid,
				{ headers },
			);
			if (response.status !== 204 && response.status !== 200) {
				throw new Error("Failed to delete message");
			}
			return { success: true };
		}),

	getToken: authedProcedure.handler(async ({ context }) => {
		const { env, session } = context;

		if (
			!env.TWILIO_ACCOUNT_SID ||
			!env.TWILIO_API_KEY ||
			!env.TWILIO_API_SECRET ||
			!env.TWILIO_SERVICE_SID
		) {
			throw new Error("Twilio credentials not configured");
		}

		const userIdentity = session.user.email;
		await ensureConversationAndParticipant(env, userIdentity);

		const token = await createTwilioAccessTokenJwt({
			accountSid: env.TWILIO_ACCOUNT_SID,
			apiKeySid: env.TWILIO_API_KEY,
			apiKeySecret: env.TWILIO_API_SECRET,
			options: {
				identity: userIdentity,
				serviceSid: env.TWILIO_SERVICE_SID,
			},
		});

		return { token };
	}),

	getEventSync: authedProcedure.handler(async ({ context }) => {
		const { env } = context;
		if (!env.TWILIO_EVENT_SYNC_ID) {
			throw new Error("TWILIO_EVENT_SYNC_ID is not configured");
		}
		const headers = getTwilioAuthHeaders(env);

		const sinkResponse = await fetchSink(env.TWILIO_EVENT_SYNC_ID, { headers });
		const subscriptionResponse = await fetchSubscription(
			env.TWILIO_EVENT_SYNC_ID,
			{ headers },
		);
		const sinkSubscriptionsResponse = await listSubscription(
			{ SinkSid: env.TWILIO_EVENT_SYNC_ID },
			{ headers },
		);
		const subscribedEventsResponse = await listSubscribedEvent(
			sinkSubscriptionsResponse.data.subscriptions?.[0]?.sid || "",
			undefined,
			{ headers },
		);

		return {
			sink: sinkResponse.data,
			subscription: subscriptionResponse.data,
			subscribedEvents: subscribedEventsResponse.data.types || [],
		};
	}),

	updateEventSyncSubscription: authedProcedure
		.input(
			z.object({
				description: z.string().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env } = context;
			if (!env.TWILIO_EVENT_SYNC_ID) {
				throw new Error("TWILIO_EVENT_SYNC_ID is not configured");
			}
			const headers = getTwilioAuthHeaders(env);
			const response = await updateSubscription(
				env.TWILIO_EVENT_SYNC_ID,
				{ Description: input.description },
				{ headers },
			);
			return { subscription: response.data };
		}),

	addEventSyncType: authedProcedure
		.input(
			z.object({
				eventType: z.string(),
				schemaVersion: z.number().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env } = context;
			if (!env.TWILIO_EVENT_SYNC_ID) {
				throw new Error("TWILIO_EVENT_SYNC_ID is not configured");
			}
			const headers = getTwilioAuthHeaders(env);

			// Get the first subscription for the sink
			const sinkSubscriptionsResponse = await listSubscription(
				{ SinkSid: env.TWILIO_EVENT_SYNC_ID },
				{ headers },
			);
			const firstSubscription =
				sinkSubscriptionsResponse.data.subscriptions?.[0];
			if (!firstSubscription?.sid) {
				throw new Error("No subscription found for the sink");
			}

			// Check if the subscribed event already exists
			const existingEventResponse = await fetchSubscribedEvent(
				firstSubscription.sid,
				input.eventType,
				{ headers },
			);

			// If it exists (200), update it
			if (existingEventResponse.status === 200) {
				const response = await updateSubscribedEvent(
					firstSubscription.sid,
					input.eventType,
					{
						SchemaVersion: input.schemaVersion,
					},
					{ headers },
				);
				return { subscribedEvent: response.data };
			}

			// If it doesn't exist (404), create it using POST to /Subscriptions/{sid}/SubscribedEvents
			// This matches the curl format: POST with Type and SchemaVersion as form-urlencoded
			if (existingEventResponse.status === 404) {
				const response = await createSubscribedEvent(
					firstSubscription.sid,
					{
						Type: input.eventType,
						SchemaVersion: input.schemaVersion,
					},
					{ headers },
				);
				return { subscribedEvent: response.data };
			}

			// Other status codes are errors
			throw new Error(
				`Failed to check subscribed event: ${existingEventResponse.status}`,
			);
		}),

	deleteEventSyncType: authedProcedure
		.input(
			z.object({
				eventType: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { env } = context;
			if (!env.TWILIO_EVENT_SYNC_ID) {
				throw new Error("TWILIO_EVENT_SYNC_ID is not configured");
			}
			const headers = getTwilioAuthHeaders(env);
			await deleteSubscribedEvent(env.TWILIO_EVENT_SYNC_ID, input.eventType, {
				headers,
			});
			return { success: true };
		}),
};
