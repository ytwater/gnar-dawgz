import { createAuth } from "~/lib/auth";
import type { Route } from "./+types/api.whatsapp.send";

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env as CloudflareBindings;
	const auth = createAuth(env);
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch (error) {
		return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
	}

	const { conversationSid, message } = body;

	if (!conversationSid || !message || typeof conversationSid !== "string" || typeof message !== "string") {
		return Response.json(
			{
				error: "conversationSid and message are required",
			},
			{ status: 400 },
		);
	}

	// Get the Durable Object stub
	const id = env.Whatsapp.idFromName(`twilioConv:${conversationSid}`);
	const stub = env.Whatsapp.get(id);

	// Forward the request to the DO with user email in header
	const doUrl = new URL(request.url);
	doUrl.pathname = "/send";

	const doRequest = new Request(doUrl.toString(), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-User-Email": session.user.email || "unknown",
		},
		body: JSON.stringify({ conversationSid, message }),
	});

	return stub.fetch(doRequest);
}

