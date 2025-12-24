import { createAuth } from "~/lib/auth";

import {
	fetchSink,
	fetchSubscribedEvent,
	fetchSubscription,
	listSubscribedEvent,
	listSubscription,
} from "~/lib/twilio/events-api";
import type { Route } from "./+types/api.twilio.event-sync";

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
		return new Response("Unauthorized", { status: 401 });
	}

	if (!env.TWILIO_EVENT_SYNC_ID) {
		return Response.json(
			{ error: "TWILIO_EVENT_SYNC_ID is not configured" },
			{ status: 500 },
		);
	}

	const headers = getTwilioAuthHeaders(env);

	try {
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

		return Response.json({
			sink: sinkResponse.data,
			subscription: subscriptionResponse.data,
			subscribedEvents: subscribedEventsResponse.data.types || [],
		});
	} catch (error) {
		console.error("Error fetching event sync:", error);
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

	if (!env.TWILIO_EVENT_SYNC_ID) {
		return Response.json(
			{ error: "TWILIO_EVENT_SYNC_ID is not configured" },
			{ status: 500 },
		);
	}

	const headers = getTwilioAuthHeaders(env);
	const body = await request.json().catch(() => ({}));

	if (request.method === "DELETE") {
		// Delete subscribed event
		const { eventType } = body;
		if (!eventType || typeof eventType !== "string") {
			return Response.json({ error: "eventType is required" }, { status: 400 });
		}

		try {
			await deleteSubscribedEvent(env.TWILIO_EVENT_SYNC_ID, eventType, {
				headers,
			});
			return Response.json({ success: true });
		} catch (error) {
			console.error("Error deleting subscribed event:", error);
			return Response.json(
				{ error: error instanceof Error ? error.message : "Unknown error" },
				{ status: 500 },
			);
		}
	}

	// POST - Update subscription or add subscribed event
	const { action: actionType, description, eventType, schemaVersion } = body;

	if (actionType === "updateSubscription") {
		// Update subscription description
		try {
			const response = await updateSubscription(
				env.TWILIO_EVENT_SYNC_ID,
				{ Description: description },
				{ headers },
			);
			return Response.json({ subscription: response.data });
		} catch (error) {
			console.error("Error updating subscription:", error);
			return Response.json(
				{ error: error instanceof Error ? error.message : "Unknown error" },
				{ status: 500 },
			);
		}
	}

	if (actionType === "addEvent") {
		// Add subscribed event
		if (!eventType || typeof eventType !== "string") {
			return Response.json({ error: "eventType is required" }, { status: 400 });
		}

		try {
			const response = await createSubscribedEvent(
				env.TWILIO_EVENT_SYNC_ID,
				{
					Type: eventType,
					SchemaVersion: schemaVersion,
				},
				{ headers },
			);
			return Response.json({ subscribedEvent: response.data });
		} catch (error) {
			console.error("Error adding subscribed event:", error);
			return Response.json(
				{ error: error instanceof Error ? error.message : "Unknown error" },
				{ status: 500 },
			);
		}
	}

	return Response.json({ error: "Invalid action" }, { status: 400 });
}
