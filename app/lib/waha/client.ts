import { WAHA_SESSION_NAME } from "~/app/config/constants";
import { chattingControllerSendText } from "../whatsapp/whatsapp-api";

/**
 * Send a message via WAHA
 */
export async function sendWahaMessage(
	env: CloudflareBindings,
	chatId: string,
	text: string,
	replyTo?: string,
) {
	const sessionId = WAHA_SESSION_NAME;
	const apiKey = env.WAHA_API_KEY;

	if (!apiKey) {
		throw new Error("WAHA_API_KEY is not configured");
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
