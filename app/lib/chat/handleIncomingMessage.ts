import {
	TWILIO_WHATSAPP_NUMBER,
	VALID_WHATSAPP_INCOMING_NUMBERS,
} from "~/config/constants";
import { WhatsAppAgent } from "../../../workers/whatsapp-agent";
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

		console.log("Handling incoming message:", event);

		const senderNumber = event.data.from;
		const messageText = event.data.body;

		if (!messageText || messageText.trim().length === 0) {
			console.log("Empty message, skipping");
			return;
		}

		// Create WhatsApp agent instance for this conversation
		// TODO: Implement state persistence (e.g., using KV or Durable Objects)
		// to maintain conversation history across webhook calls
		const agent = new WhatsAppAgent(env);

		// Get AI response from the agent
		const responseText = await agent.onMessage(senderNumber, messageText);

		// Send response back via Twilio
		const payload: CreateMessageBody = {
			From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
			To: senderNumber,
			Body: responseText,
		};

		console.log("🚀 ~ handleIncomingMessage ~ sending response:", payload);

		const messageResponse = await createMessage(env, payload);
		console.log(
			"🚀 ~ handleIncomingMessage ~ messageResponse:",
			messageResponse,
		);
	} catch (error) {
		console.error("Error handling incoming message:", error);
		// Optionally send an error message to the user
		try {
			await createMessage(env, {
				From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
				To: event.data.from,
				Body: "Sorry, I encountered an error processing your message. Please try again.",
			});
		} catch (sendError) {
			console.error("Error sending error message:", sendError);
		}
	}
}
