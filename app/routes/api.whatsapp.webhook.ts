import { TWILIO_WHATSAPP_NUMBER } from "~/app/config/constants";
import {
	type CreateMessageBody,
	createMessage,
} from "~/app/lib/twilio/classic-messages-api";
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

		// Handle array of events (CloudEvents format)
		const events = Array.isArray(params) ? params : [params];
		const eventPromises = [];
		for (const event of events) {
			if (event?.type === "com.twilio.messaging.inbound-message.received") {
				console.log(`processing message: ${event.data.body}`);
				// Offload processing to Cloudflare Queue
				const senderNumber = event.data.from;

				const payload: CreateMessageBody = {
					From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
					To: senderNumber,
					Body: "Thinking...",
				};

				// console.log("🚀 ~ handleIncomingMessage ~ sending response:", payload);
				eventPromises.push(createMessage(env, payload));
				eventPromises.push(env.WHATSAPP_QUEUE.send(event));
			}
		}
		await Promise.all(eventPromises);

		console.log("webhook finished");
		return Response.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error(
			"Error in api.whatsapp.webhook.ts:",
			error instanceof Error ? error.message : "Unknown error",
		);
		// Even on error, try to return a valid TwiML to stop retries if possible,
		// or just 200 OK.
		// Sending 500 will cause Twilio to retry, which might be desired for transient errors,
		// but for application logic errors it's better to stop.
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}
