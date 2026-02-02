import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText } from "ai";
import { generateId } from "ai";
import { desc, eq } from "drizzle-orm";
import { WhatsAppAgent } from "../../../workers/whatsapp-agent";
import { getDb } from "../db";
import { charter, users, whatsappMessages } from "../schema";
import { sendWahaMessage } from "./client";
import type { WahaMessageEvent } from "./types";

/**
 * Determine if the bot should reply to a group message
 */
export async function shouldReplyToGroup(
	body: string,
	meId: string | undefined,
	env: CloudflareBindings,
	history: { role: string; content: string }[] = [],
): Promise<boolean> {
	const text = body.toLowerCase();

	// 1. Direct mention (e.g. contains bot's ID or common bot names)
	if (meId && text.includes(meId.split("@")[0])) {
		return true;
	}

	// Also check for common mentions like "@bot" or "gnar dawgs"
	if (
		text.includes("@bot") ||
		text.includes("gnar dawgs") ||
		text.includes("gnardawgs")
	) {
		return true;
	}

	// 2. Use AI to classify if the content is relevant (surf forecast, demerits, or rule violations)
	const db = getDb(env.DB);
	const charterResults = await db.select().from(charter).limit(1);
	const charterContent =
		charterResults[0]?.content || "No rules established yet.";

	const baseURL = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.AI_GATEWAY_ID}/deepseek`;
	const deepseek = createDeepSeek({
		apiKey: env.DEEPSEEK_API_KEY ?? "",
		baseURL,
		headers: {
			"cf-aig-authorization": env.CLOUDFLARE_API_TOKEN ?? "",
		},
	});
	const model = deepseek.languageModel("deepseek-chat");

	const historyContext = history
		.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
		.join("\n");

	const { text: classification } = await generateText({
		model,
		system: `You are a message classifier for a surf collective bot. Analyze the message and decide if the bot should join the conversation.
The bot handles:
1. Surf forecasts
2. A 'demerit' system (assigning/clearing demerits)
3. Monitoring for violations of the Global Charter.

Global Charter:
${charterContent}

Recent Conversation Context:
${historyContext}

Reply ONLY with 'YES' if the NEW MESSAGE is about surfing, forecasts, demerits, addressing the bot, or if it appears to be a violation of the Global Charter. Reply 'NO' otherwise.`,
		prompt: `NEW MESSAGE: ${body}`,
	});

	return classification.trim().toUpperCase() === "YES";
}

/**
 * Handle incoming WAHA message event
 */
export async function handleWahaMessage(
	event: WahaMessageEvent,
	env: CloudflareBindings,
) {
	const { payload, me } = event;
	const isGroup = payload.from.endsWith("@g.us");
	const senderId = payload.from; // This is the chat ID (group or person)
	const participantId = payload.participant; // Individual sender in a group

	// If it's from me, don't respond to ourselves
	if (payload.fromMe) return;

	const isDev = env.ENVIRONMENT === "dev";
	let messageText = payload.body.trim();
	const lowerText = messageText.toLowerCase();
	const isDevColon = lowerText.startsWith("dev:");
	const isDevSpace = lowerText.startsWith("dev ");
	const isDevMessage = isDevColon || isDevSpace;

	if (isDevMessage) {
		if (!isDev) {
			console.log("Ignoring dev message in prod environment");
			return;
		}
		// Strip "dev:" or "dev " prefix
		messageText = messageText.slice(isDevColon ? 4 : 3).trim();
	} else {
		if (isDev) {
			console.log("Ignoring non-dev message in dev environment");
			return;
		}
	}

	// Ensure user/group exists in our database
	const db = getDb(env.DB);
	const phoneNumber = senderId.replace(/@c\.us|@g\.us/, "");

	let userResult = await db
		.select()
		.from(users)
		.where(eq(users.phoneNumber, phoneNumber))
		.limit(1);

	let user = userResult[0];

	if (!user) {
		console.log(
			`Creating record for ${isGroup ? "group" : "user"}: ${senderId}`,
		);
		const name = isGroup ? `Group ${phoneNumber}` : `WAHA User ${phoneNumber}`;
		const newUserId = generateId();
		await db.insert(users).values({
			id: newUserId,
			name,
			email: `${phoneNumber}@gnardawgs.surf`,
			phoneNumber: phoneNumber,
			phoneNumberVerified: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		userResult = await db
			.select()
			.from(users)
			.where(eq(users.id, newUserId))
			.limit(1);
		user = userResult[0];
	}

	// Always save the message to history first (before decide if respond)
	// This ensures the bot has context of the "listening" period
	await db.insert(whatsappMessages).values({
		id: generateId(),
		userId: user.id,
		role: "user",
		content: messageText,
		createdAt: new Date(),
	});

	// Load recent history for context (last 10 most recent messages)
	const recentMessages = await db
		.select()
		.from(whatsappMessages)
		.where(eq(whatsappMessages.userId, user.id))
		.orderBy(desc(whatsappMessages.createdAt))
		.limit(10);

	// Reverse to get chronological order for the AI
	const history = recentMessages.reverse().map((m) => ({
		role: m.role,
		content: m.content,
	}));

	// Decide if we should respond
	if (isGroup) {
		const shouldReply = await shouldReplyToGroup(
			messageText,
			me?.id,
			env,
			history,
		);
		if (!shouldReply) {
			console.log(`Skipping group message: ${messageText}`);
			return;
		}
	}

	// Use the WhatsAppAgent to generate a response
	const agent = new WhatsAppAgent(env, user);
	const responseText = await agent.onMessage(
		senderId,
		messageText,
		isGroup,
		true,
	);

	// Send the response back via WAHA
	const finalResponse = isDev ? `dev: ${responseText}` : responseText;
	await sendWahaMessage(env, senderId, finalResponse, { replyTo: payload.id });
}
