import type { ActionFunctionArgs } from "react-router";

export async function action({ request, context }: ActionFunctionArgs) {
	const env = context.cloudflare.env as CloudflareBindings;
	try {
		const payload = (await request.json()) as unknown;
		console.log("WAHA Webhook received:", JSON.stringify(payload, null, 2));

		// Support both single event and array of events if WAHA sends them
		const events = Array.isArray(payload) ? payload : [payload];

		for (const event of events) {
			if (event.event === "message" || event.event === "message.any") {
				// Offload processing to Cloudflare Queue
				await env.WHATSAPP_QUEUE.send(event);
			} else {
				console.log(`Received unhandled WAHA event: ${event.event}`);
			}
		}

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Error in WAHA webhook:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}

// WAHA usually sends POST requests for webhooks
export async function loader() {
	return new Response("WAHA Webhook Endpoint Active", { status: 200 });
}
