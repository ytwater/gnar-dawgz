import { WAHA_SESSION_NAME } from "~/app/config/constants";
import {
	chattingControllerSendSeen,
	chattingControllerSendText,
	chattingControllerStartTyping,
	chattingControllerStopTyping,
} from "../whatsapp/whatsapp-api";

/**
 * Send a message via WAHA with human-like behavior
 */
export async function sendWahaMessage(
	env: CloudflareBindings,
	chatId: string,
	text: string,
	options: {
		replyTo?: string;
		sendSeen?: boolean;
		simulateTyping?: boolean;
	} = {},
) {
	const { replyTo, sendSeen = true, simulateTyping = true } = options;
	const sessionId = WAHA_SESSION_NAME;
	const apiKey = env.WAHA_API_KEY;

	if (!apiKey) {
		throw new Error("WAHA_API_KEY is not configured");
	}

	if (sendSeen) {
		await sendWahaSeen(env, chatId);
	}

	if (simulateTyping) {
		await startWahaTyping(env, chatId);
		// Estimate typing time: ~100ms per character + some randomness
		// Minimum 500ms, maximum 5 seconds to avoid hanging too long
		const typingTime = Math.min(
			Math.max(text.length * (50 + Math.random() * 50), 500),
			5000,
		);
		await new Promise((resolve) => setTimeout(resolve, typingTime));
		await stopWahaTyping(env, chatId);
	}

	const response = await chattingControllerSendText(
		{
			chatId,
			text,
			session: sessionId,
			reply_to: replyTo,
		},
		{
			headers: {
				"X-Api-Key": apiKey,
			},
		},
	);

	if (response.status !== 201 && response.status !== 200) {
		console.error("WAHA send text failed", response);
		throw new Error(`WAHA send text failed with status ${response.status}`);
	}

	return response.data;
}

/**
 * Send "seen" status
 */
export async function sendWahaSeen(env: CloudflareBindings, chatId: string) {
	const apiKey = env.WAHA_API_KEY;
	if (!apiKey) return;

	await chattingControllerSendSeen(
		{ chatId, session: WAHA_SESSION_NAME },
		{
			headers: {
				"X-Api-Key": apiKey,
			},
		},
	);
}

/**
 * Start typing
 */
export async function startWahaTyping(env: CloudflareBindings, chatId: string) {
	const apiKey = env.WAHA_API_KEY;
	if (!apiKey) return;

	await chattingControllerStartTyping(
		{ chatId, session: WAHA_SESSION_NAME },
		{
			headers: {
				"X-Api-Key": apiKey,
			},
		},
	);
}

/**
 * Stop typing
 */
export async function stopWahaTyping(env: CloudflareBindings, chatId: string) {
	const apiKey = env.WAHA_API_KEY;
	if (!apiKey) return;

	await chattingControllerStopTyping(
		{ chatId, session: WAHA_SESSION_NAME },
		{
			headers: {
				"X-Api-Key": apiKey,
			},
		},
	);
}
