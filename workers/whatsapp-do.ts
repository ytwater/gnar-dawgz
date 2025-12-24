import {
	createServiceConversationMessage,
	listServiceConversationMessage,
} from "../app/lib/twilio/conversation-api";

type Message = {
	sid: string;
	index: number | null;
	author: string | null;
	body: string | null;
	dateCreated: string;
	dateUpdated: string;
	attributes: string;
};

type WebSocketMessage = {
	type: "snapshot" | "message_added" | "error";
	messages?: Message[];
	message?: Message;
	error?: string;
};

function getTwilioAuthHeaders(env: CloudflareBindings): HeadersInit {
	const envWithToken = env as { TWILIO_AUTH_TOKEN?: string };
	if (envWithToken.TWILIO_AUTH_TOKEN) {
		const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${envWithToken.TWILIO_AUTH_TOKEN}`);
		return {
			Authorization: `Basic ${auth}`,
		};
	}
	if (!env.TWILIO_API_KEY || !env.TWILIO_API_SECRET) {
		throw new Error("TWILIO_API_KEY and TWILIO_API_SECRET are required");
	}
	const auth = btoa(`${env.TWILIO_API_KEY}:${env.TWILIO_API_SECRET}`);
	return {
		Authorization: `Basic ${auth}`,
	};
}

export class Whatsapp implements DurableObject {
	private state: DurableObjectState;
	private env: CloudflareBindings;
	private conversationSid: string | null = null;
	private sockets: Set<WebSocket> = new Set();

	constructor(state: DurableObjectState, env: CloudflareBindings) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		if (path === "/ws") {
			return this.handleWebSocket(request);
		} else if (path === "/send") {
			return this.handleSend(request);
		} else if (path === "/webhook") {
			return this.handleWebhook(request);
		} else if (path === "/sync") {
			return this.handleSync(request);
		}

		return new Response("Not found", { status: 404 });
	}

	private async handleWebSocket(request: Request): Promise<Response> {
		// Extract conversationSid from query or header
		const url = new URL(request.url);
		const conversationSid = url.searchParams.get("conversationSid");
		
		if (!conversationSid) {
			return new Response("conversationSid required", { status: 400 });
		}

		this.conversationSid = conversationSid;

		// Upgrade to WebSocket
		const upgradeHeader = request.headers.get("Upgrade");
		if (upgradeHeader !== "websocket") {
			return new Response("Expected Upgrade: websocket", { status: 426 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// Accept the WebSocket connection
		this.acceptWebSocket(server);

		// Send initial snapshot
		await this.sendSnapshot(server);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	private acceptWebSocket(ws: WebSocket) {
		ws.accept();
		this.sockets.add(ws);

		ws.addEventListener("close", () => {
			this.sockets.delete(ws);
		});

		ws.addEventListener("error", () => {
			this.sockets.delete(ws);
		});
	}

	private async sendSnapshot(ws: WebSocket) {
		try {
			const messages = await this.getMessages();
			const snapshot: WebSocketMessage = {
				type: "snapshot",
				messages,
			};
			ws.send(JSON.stringify(snapshot));
		} catch (error) {
			const errorMsg: WebSocketMessage = {
				type: "error",
				error: error instanceof Error ? error.message : "Failed to load messages",
			};
			ws.send(JSON.stringify(errorMsg));
		}
	}

	private async handleSend(request: Request): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		try {
			const body = await request.json();
			const { message } = body;
			const userEmail = request.headers.get("X-User-Email");

			if (!message || typeof message !== "string") {
				return Response.json({ error: "message is required" }, { status: 400 });
			}

			if (!this.conversationSid) {
				// Try to get from storage or request
				this.conversationSid = body.conversationSid || (await this.state.storage.get<string>("conversationSid"));
				if (!this.conversationSid) {
					return Response.json({ error: "conversationSid not set" }, { status: 400 });
				}
			}

			if (!this.env.TWILIO_SERVICE_SID) {
				return Response.json({ error: "TWILIO_SERVICE_SID not configured" }, { status: 500 });
			}

			const headers = getTwilioAuthHeaders(this.env);

			// Send message via Twilio REST API
			const response = await createServiceConversationMessage(
				this.env.TWILIO_SERVICE_SID,
				this.conversationSid,
				{
					Author: userEmail || "unknown",
					Body: message,
				},
				{ headers },
			);

			if (response.status !== 201 || !response.data?.sid) {
				return Response.json(
					{ error: `Twilio API error: ${response.status}` },
					{ status: response.status },
				);
			}

			// Convert Twilio message to our format
			const newMessage: Message = {
				sid: response.data.sid,
				index: response.data.index ?? null,
				author: response.data.author ?? null,
				body: response.data.body ?? null,
				dateCreated: response.data.dateCreated ?? new Date().toISOString(),
				dateUpdated: response.data.dateUpdated ?? new Date().toISOString(),
				attributes: typeof response.data.attributes === "string" 
					? response.data.attributes 
					: JSON.stringify(response.data.attributes || {}),
			};

			// Store message
			await this.addMessage(newMessage);

			// Broadcast to all connected clients
			this.broadcast({
				type: "message_added",
				message: newMessage,
			});

			return Response.json(newMessage);
		} catch (error) {
			console.error("Error sending message:", error);
			return Response.json(
				{ error: error instanceof Error ? error.message : "Unknown error" },
				{ status: 500 },
			);
		}
	}

	private async handleWebhook(request: Request): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		try {
			// Extract conversationSid from webhook payload
			const formData = await request.formData();
			const conversationSid = formData.get("ConversationSid")?.toString();

			if (!conversationSid) {
				// Try to get from storage
				this.conversationSid = await this.state.storage.get<string>("conversationSid");
				if (!this.conversationSid) {
					console.warn("Webhook received but no conversationSid found");
					return Response.json({ error: "conversationSid not found" }, { status: 400 });
				}
			} else {
				this.conversationSid = conversationSid;
				await this.state.storage.put("conversationSid", conversationSid);
			}

			// Trigger sync from Twilio
			await this.syncFromTwilio();

			return Response.json({ success: true });
		} catch (error) {
			console.error("Error handling webhook:", error);
			return Response.json(
				{ error: error instanceof Error ? error.message : "Unknown error" },
				{ status: 500 },
			);
		}
	}

	private async handleSync(request: Request): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		try {
			await this.syncFromTwilio();
			return Response.json({ success: true });
		} catch (error) {
			console.error("Error syncing:", error);
			return Response.json(
				{ error: error instanceof Error ? error.message : "Unknown error" },
				{ status: 500 },
			);
		}
	}

	private async syncFromTwilio(): Promise<void> {
		if (!this.conversationSid) {
			this.conversationSid = await this.state.storage.get<string>("conversationSid");
			if (!this.conversationSid) {
				throw new Error("conversationSid not set");
			}
		}

		if (!this.env.TWILIO_SERVICE_SID) {
			throw new Error("TWILIO_SERVICE_SID not configured");
		}

		const headers = getTwilioAuthHeaders(this.env);

		// Get last message index from storage for incremental sync
		const lastIndex = (await this.state.storage.get<number>("lastIndex")) ?? 0;

		// Fetch messages from Twilio (get last 100 messages)
		const response = await listServiceConversationMessage(
			this.env.TWILIO_SERVICE_SID,
			this.conversationSid,
			{
				PageSize: "100",
			},
			{ headers },
		);

		if (response.status !== 200 || !response.data?.messages) {
			throw new Error(`Twilio API error: ${response.status}`);
		}

		const twilioMessages = response.data.messages;
		const existingMessages = await this.getMessages();
		const existingSids = new Set(existingMessages.map((m) => m.sid));

		// Convert and merge new messages
		const newMessages: Message[] = [];
		for (const twilioMsg of twilioMessages) {
			if (!twilioMsg.sid || existingSids.has(twilioMsg.sid)) {
				continue; // Skip duplicates
			}

			const message: Message = {
				sid: twilioMsg.sid,
				index: twilioMsg.index ?? null,
				author: twilioMsg.author ?? null,
				body: twilioMsg.body ?? null,
				dateCreated: twilioMsg.dateCreated ?? new Date().toISOString(),
				dateUpdated: twilioMsg.dateUpdated ?? new Date().toISOString(),
				attributes: typeof twilioMsg.attributes === "string"
					? twilioMsg.attributes
					: JSON.stringify(twilioMsg.attributes || {}),
			};

			newMessages.push(message);
		}

		// Add new messages
		for (const msg of newMessages) {
			await this.addMessage(msg);
		}

		// Update last index
		if (twilioMessages.length > 0) {
			const maxIndex = Math.max(
				...twilioMessages.map((m) => m.index ?? 0).filter((idx) => idx !== null),
			);
			if (maxIndex > lastIndex) {
				await this.state.storage.put("lastIndex", maxIndex);
			}
		}

		// Broadcast new messages to connected clients
		for (const msg of newMessages) {
			this.broadcast({
				type: "message_added",
				message: msg,
			});
		}
	}

	private async getMessages(): Promise<Message[]> {
		const messages = (await this.state.storage.get<Message[]>("messages")) ?? [];
		// Sort by dateCreated
		return messages.sort((a, b) => {
			const dateA = new Date(a.dateCreated).getTime();
			const dateB = new Date(b.dateCreated).getTime();
			return dateA - dateB;
		});
	}

	private async addMessage(message: Message): Promise<void> {
		const messages = await this.getMessages();
		
		// Check for duplicates
		if (messages.some((m) => m.sid === message.sid)) {
			return;
		}

		messages.push(message);

		// Cap at 500 messages
		if (messages.length > 500) {
			messages.sort((a, b) => {
				const dateA = new Date(a.dateCreated).getTime();
				const dateB = new Date(b.dateCreated).getTime();
				return dateA - dateB;
			});
			messages.splice(0, messages.length - 500);
		}

		await this.state.storage.put("messages", messages);
	}

	private broadcast(message: WebSocketMessage): void {
		const data = JSON.stringify(message);
		for (const ws of this.sockets) {
			try {
				ws.send(data);
			} catch (error) {
				console.error("Error broadcasting to WebSocket:", error);
				this.sockets.delete(ws);
			}
		}
	}
}

