import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText } from "ai";
import { generateId } from "ai";
import { desc, eq } from "drizzle-orm";
import { WhatsAppAgent } from "../../../workers/whatsapp-agent";
import { getAppUrl } from "../../config/constants";
import { getDb } from "../db";
import { charter, users, verifications, whatsappMessages } from "../schema";
import { sendWahaMessage } from "./client";
import type { WahaMessageEvent } from "./types";

/** Whether the message text is a direct mention of the bot (e.g. @bot, gnar dawgs, or me id). */
export function isDirectMention(
	body: string,
	meId: string | undefined,
): boolean {
	const text = body.toLowerCase();
	if (meId && text.includes(meId.split("@")[0])) return true;
	return (
		text.includes("@bot") ||
		text.includes("gnar dawgs") ||
		text.includes("gnardawgs")
	);
}

/** Whether the message is asking for login or website info. */
export function isLoginOrWebsiteRequest(text: string): boolean {
	const t = text.toLowerCase();
	return (
		/\b(login|log in|sign in|website|site|web)\b/.test(t) ||
		/how (do i |to )?(get )?in\b/.test(t) ||
		/where (is |to )?(the )?(login|site|website)\b/.test(t)
	);
}

/**
 * Determine if the bot should reply to a group message
 */
export async function shouldReplyToGroup(
	body: string,
	meId: string | undefined,
	env: CloudflareBindings,
	history: { role: string; content: string }[] = [],
): Promise<boolean> {
	if (isDirectMention(body, meId)) return true;

	// Use AI to classify if the content is relevant (surf forecast, demerits, or rule violations)
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
		if (isGroup) {
			console.log(`Creating record for group: ${senderId}`);
			const newUserId = generateId();
			await db.insert(users).values({
				id: newUserId,
				name: `Group ${phoneNumber}`,
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
		} else {
			// Direct message from unknown user: same as Twilio — only create and process for onboarding passphrase
			const onboardingPassphrase =
				messageText === "woof woof" || messageText === "ruff ruff";
			if (!onboardingPassphrase) {
				console.log(`Ignoring message from unknown user ${phoneNumber}`);
				return;
			}
			console.log(`Unlocking onboarding for ${phoneNumber}`);
			const newUserId = generateId();
			await db.insert(users).values({
				id: newUserId,
				name: "Guest",
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
	}

	// In group chats, ensure the participant has a user record so they're provisioned.
	// When they first DM the bot they'll be looked up by phone and go through onboarding (Guest → "what's your name").
	if (isGroup && participantId) {
		const participantPhone = participantId.replace(
			/@c\.us|@s\.whatsapp\.net/g,
			"",
		);
		const participantUserResult = await db
			.select()
			.from(users)
			.where(eq(users.phoneNumber, participantPhone))
			.limit(1);
		if (!participantUserResult[0]) {
			const newUserId = generateId();
			await db.insert(users).values({
				id: newUserId,
				name: "Guest",
				email: `${participantPhone}@gnardawgs.surf`,
				phoneNumber: participantPhone,
				phoneNumberVerified: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.log(
				`Provisioned user for group participant: ${participantPhone}`,
			);
		}
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

		// Login/website request when bot is mentioned: DM the participant with login link, reply in group that we'll reach out.
		if (
			participantId &&
			isDirectMention(messageText, me?.id) &&
			isLoginOrWebsiteRequest(messageText)
		) {
			const participantPhone = participantId.replace(
				/@c\.us|@s\.whatsapp\.net/,
				"",
			);
			const code = Math.floor(100000 + Math.random() * 900000);
			await db.insert(verifications).values({
				id: generateId(),
				identifier: participantPhone,
				value: `${code}:0`,
				expiresAt: new Date(Date.now() + 1000 * 60 * 5),
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			const host = getAppUrl(env);
			const loginLink = `${host}/login?phone=${encodeURIComponent(participantPhone)}&code=${code}`;
			const dmText = `Here’s your login link: ${loginLink}\n\nYou can also go to ${host}/login and enter the code: ${code}.`;
			await sendWahaMessage(env, participantId, dmText, {
				simulateTyping: false,
				sendSeen: true,
			});
			const groupReply = "I’ll reach out to you directly.";
			await sendWahaMessage(env, senderId, groupReply, {
				replyTo: payload.id,
				simulateTyping: true,
			});
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
