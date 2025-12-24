import type { Route } from "./+types/api.whatsapp.webhook";

/**
 * Validates Twilio EventStreams webhook signature using HMAC-SHA1
 * For EventStreams with bodySHA256: signature is computed over URL only (empty body)
 * For regular webhooks: signature is computed over URL + rawRequestBody
 * Based on: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
async function validateTwilioSignature(
	authToken: string,
	signature: string,
	url: string,
	rawBody: string,
): Promise<boolean> {
	// Compute HMAC-SHA1 over url + rawBody
	const message = url + rawBody;
	const encoder = new TextEncoder();
	const keyData = encoder.encode(authToken);
	const messageData = encoder.encode(message);

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

	try {
		// Get Twilio auth token
		const authToken = env.TWILIO_AUTH_TOKEN;

		if (!authToken) {
			console.error("TWILIO_AUTH_TOKEN not configured");
			throw new Error("Server configuration error");
		}

		// Get signature from header
		const signature = request.headers.get("X-Twilio-Signature");
		if (!signature) {
			throw new Error("Missing X-Twilio-Signature header");
		}

		// Read raw body for signature validation (must be done before parsing JSON)
		const rawBody = await request.text();

		// Parse JSON for processing
		const params = JSON.parse(rawBody);

		// Determine signature format based on bodySHA256 query parameter
		const url = new URL(request.url);
		const bodySHA256 = url.searchParams.get("bodySHA256");

		let fullUrl: string;
		let bodyForSignature: string;

		if (bodySHA256) {
			// For EventStreams with bodySHA256: verify the hash matches, then sign URL only
			const bodyHashBuffer = await crypto.subtle.digest(
				"SHA-256",
				new TextEncoder().encode(rawBody),
			);
			const bodyHashArray = Array.from(new Uint8Array(bodyHashBuffer));
			const bodyHashHex = bodyHashArray
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");

			if (bodySHA256.toLowerCase() !== bodyHashHex.toLowerCase()) {
				throw new Error(
					"bodySHA256 mismatch - body may have been tampered with",
				);
			}

			// Use HTTPS URL with bodySHA256 query param, empty body
			fullUrl = `https://${url.host}${url.pathname}${url.search}`;
			bodyForSignature = "";
		} else {
			// For regular webhooks: use URL + body
			fullUrl = `https://${url.host}${url.pathname}${url.search}`;
			bodyForSignature = rawBody;
		}

		// Validate signature
		const isValid = await validateTwilioSignature(
			authToken,
			signature,
			fullUrl,
			bodyForSignature,
		);
		if (!isValid) {
			console.warn("Invalid Twilio signature");
			throw new Error("Invalid signature");
		}

		console.log("🚀 ~ api.whatsapp.webhook.ts:71 ~ action ~ params:", params);

		// Extract conversationSid
		const conversationSid = params.ConversationSid;
		if (!conversationSid) {
			console.warn("Webhook received but no ConversationSid in params");
			// Still forward to DO in case it can handle it
		}

		// // Get the Durable Object stub
		// // If we have a conversationSid, use it; otherwise use a default key
		// const doKey = conversationSid ? `twilioConv:${conversationSid}` : "twilioConv:default";
		// const id = env.Whatsapp.idFromName(doKey);
		// const stub = env.Whatsapp.get(id);

		// // Forward the webhook to the DO
		// // We need to reconstruct the form data since we've already consumed it
		// const doUrl = new URL(request.url);
		// doUrl.pathname = "/webhook";

		// // Create a new form data for the DO
		// const doFormData = new FormData();
		// for (const [key, value] of formData.entries()) {
		// 	doFormData.append(key, value);
		// }

		// const doRequest = new Request(doUrl.toString(), {
		// 	method: "POST",
		// 	headers: {
		// 		"Content-Type": request.headers.get("Content-Type") || "application/x-www-form-urlencoded",
		// 	},
		// 	body: doFormData,
		// });

		// return stub.fetch(doRequest);
		return Response.json({ success: true, message: "Webhook received" });
	} catch (error) {
		console.error(
			"Error in api.whatsapp.webhook.ts:",
			error instanceof Error ? error.message : "Unknown error",
		);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}
