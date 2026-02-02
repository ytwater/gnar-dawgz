import { eq } from "drizzle-orm";
import { TWILIO_WHATSAPP_NUMBER } from "~/app/config/constants";
import { WhatsAppAgent } from "../../../workers/whatsapp-agent";
import { getDb } from "../db";
import { users } from "../schema";
import {
	type CreateMessageBody,
	createMessage,
} from "../twilio/classic-messages-api";

export type TwilioInboundMessageEvent = {
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
	const isDev = env.ENVIRONMENT === "dev";
	try {
		if (
			!event.data.to ||
			event.data.to !== `whatsapp:${TWILIO_WHATSAPP_NUMBER}`
		) {
			console.log("Invalid incoming number", event.data.to);
			return;
		}

		const fromNumber = event.data.from?.replace("whatsapp:", "") ?? "";
		if (!fromNumber) {
			console.log("Invalid incoming number", event.data.from);
			return;
		}

		if (
			env.ENVIRONMENT !== "dev" &&
			event.data.body.toLocaleLowerCase().startsWith("dev:")
		) {
			console.log("Dev message in non-dev environment, skipping");
			return;
		}
		if (
			env.ENVIRONMENT === "dev" &&
			!event.data.body.toLocaleLowerCase().startsWith("dev:")
		) {
			console.log("Non-dev message in dev environment, skipping");
			return;
		}

		// Load the user from the database
		const db = getDb(env.DB);
		const usersResult = await db
			.select()
			.from(users)
			.where(eq(users.phoneNumber, fromNumber));

		if (usersResult.length === 0) {
			console.log("User not found", fromNumber);
			throw new Error(`User not found for number ${fromNumber}`);
		}

		const user = usersResult[0];

		console.log(
			"🚀 ~ handleIncomingMessage.ts:50 ~ handleIncomingMessage ~ user:",
			user,
		);
		// if (!VALID_WHATSAPP_INCOMING_NUMBERS.includes(event.data.from)) {
		// 	throw new Error("Invalid incoming number");
		// }

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
		const agent = new WhatsAppAgent(env, user);

		// Get AI response from the agent
		const responseText = await agent.onMessage(
			senderNumber,
			messageText,
			false,
		);

		// Send response back via Twilio
		const payload: CreateMessageBody = {
			From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
			To: senderNumber,
			Body: isDev ? `dev: ${responseText}` : responseText,
		};

		// console.log("🚀 ~ handleIncomingMessage ~ sending response:", payload);

		console.log(
			"🚀 ~ handleIncomingMessage ~ sending response text:",
			payload.Body,
		);
		const messageResponse = await createMessage(env, payload);
		// console.log(
		// 	"🚀 ~ handleIncomingMessage ~ messageResponse:",
		// 	messageResponse,
		// );
	} catch (error) {
		console.error("Error handling incoming message:", error);
		// Optionally send an error message to the user
		try {
			await createMessage(env, {
				From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
				To: event.data.from,
				Body: `Sorry, I encountered an error processing your message. Error ${error instanceof Error ? error.message : "Unknown error"}`,
			});
		} catch (sendError) {
			console.error("Error sending error message:", sendError);
		}
	}
}
