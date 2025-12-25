import {
	TWILIO_WHATSAPP_NUMBER,
	VALID_WHATSAPP_INCOMING_NUMBERS,
} from "~/config/constants";
import {
	type CreateMessageBody,
	createMessage,
} from "../twilio/classic-messages-api";

type TwilioInboundMessageEvent = {
	specversion: string;
	type: string;
	source: string;
	id: string;
	dataschema: string;
	datacontenttype: string;
	time: string;
	data: {
		numMedia: number;
		timestamp: string;
		accountSid: string;
		to: string;
		numSegments: number;
		messageSid: string;
		eventName: string;
		body: string;
		from: string;
	};
};

export async function handleIncomingMessage(
	event: TwilioInboundMessageEvent,
	env: CloudflareBindings,
): Promise<void> {
	try {
		// TODO Match whatsapp numbers to user
		if (!VALID_WHATSAPP_INCOMING_NUMBERS.includes(event.data.from)) {
			throw new Error("Invalid incoming number");
		}

		// TODO: Implement message handling logic
		console.log("Handling incoming message:", event);

		const payload: CreateMessageBody = {
			From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
			To: event.data.from,
			Body: "test response",
		};
		console.log(
			"🚀 ~ handleIncomingMessage.ts:46 ~ handleIncomingMessage ~ payload:",
			env.TWILIO_ACCOUNT_SID,
			payload,
		);
		const messageResponse = await createMessage(env, payload);
		console.log(
			"🚀 ~ handleIncomingMessage.ts:52 ~ handleIncomingMessage ~ messageResponse:",
			messageResponse,
		);
	} catch (error) {
		console.error("Error handling incoming message:", error);
	}
}
