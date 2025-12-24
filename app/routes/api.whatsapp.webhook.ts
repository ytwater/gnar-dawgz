import type { Route } from "./+types/api.whatsapp.webhook";

/**
 * Validates Twilio webhook signature using HMAC-SHA1
 * Based on: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
async function validateTwilioSignature(
	authToken: string,
	signature: string,
	url: string,
	params: Record<string, string>,
): Promise<boolean> {
	// Sort parameters alphabetically and concatenate
	const sortedKeys = Object.keys(params).sort();
	const data = sortedKeys.map((key) => `${key}${params[key]}`).join("");

	// Compute HMAC-SHA1
	const encoder = new TextEncoder();
	const keyData = encoder.encode(authToken);
	const messageData = encoder.encode(url + data);

	const key = await crypto.subtle.importKey(
		"raw",
		keyData,
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);

	const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);

	// Convert to base64
	const signatureArray = Array.from(new Uint8Array(signatureBuffer));
	const signatureBase64 = btoa(String.fromCharCode(...signatureArray));

	// Compare signatures (constant-time comparison)
	if (signature.length !== signatureBase64.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < signature.length; i++) {
		result |= signature.charCodeAt(i) ^ signatureBase64.charCodeAt(i);
	}

	return result === 0;
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env as CloudflareBindings;

	// Get Twilio auth token
	const envWithToken = env as { TWILIO_AUTH_TOKEN?: string };
	const authToken = envWithToken.TWILIO_AUTH_TOKEN;

	if (!authToken) {
		console.error("TWILIO_AUTH_TOKEN not configured");
		return new Response("Server configuration error", { status: 500 });
	}

	// Get signature from header
	const signature = request.headers.get("X-Twilio-Signature");
	if (!signature) {
		return new Response("Missing X-Twilio-Signature header", { status: 403 });
	}

	// Get the full URL (Twilio uses the exact URL it called)
	const url = new URL(request.url);
	const fullUrl = `${url.protocol}//${url.host}${url.pathname}`;

	// Parse form data
	const formData = await request.formData();
	const params: Record<string, string> = {};
	for (const [key, value] of formData.entries()) {
		params[key] = value.toString();
	}

	// Validate signature
	const isValid = await validateTwilioSignature(authToken, signature, fullUrl, params);
	if (!isValid) {
		console.warn("Invalid Twilio signature");
		return new Response("Invalid signature", { status: 403 });
	}

	// Extract conversationSid
	const conversationSid = params.ConversationSid;
	if (!conversationSid) {
		console.warn("Webhook received but no ConversationSid in params");
		// Still forward to DO in case it can handle it
	}

	// Get the Durable Object stub
	// If we have a conversationSid, use it; otherwise use a default key
	const doKey = conversationSid ? `twilioConv:${conversationSid}` : "twilioConv:default";
	const id = env.Whatsapp.idFromName(doKey);
	const stub = env.Whatsapp.get(id);

	// Forward the webhook to the DO
	// We need to reconstruct the form data since we've already consumed it
	const doUrl = new URL(request.url);
	doUrl.pathname = "/webhook";

	// Create a new form data for the DO
	const doFormData = new FormData();
	for (const [key, value] of formData.entries()) {
		doFormData.append(key, value);
	}

	const doRequest = new Request(doUrl.toString(), {
		method: "POST",
		headers: {
			"Content-Type": request.headers.get("Content-Type") || "application/x-www-form-urlencoded",
		},
		body: doFormData,
	});

	return stub.fetch(doRequest);
}

