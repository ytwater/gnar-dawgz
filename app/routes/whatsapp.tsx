import { Circle, PaperPlaneTilt, WhatsappLogo } from "@phosphor-icons/react";
import {
	Client,
	type Conversation as TwilioConversation,
	type Message as TwilioMessage,
} from "@twilio/conversations";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/button/Button";
import { MemoizedMarkdown } from "~/components/memoized-markdown";
import { Textarea } from "~/components/textarea/Textarea";
import { MAIN_CONVERSATION_UNIQUE_NAME } from "~/config/constants";
import { authClient } from "~/lib/auth-client";

export const handle = {
	hydrate: false,
};

export default function WhatsAppChat() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const [messages, setMessages] = useState<TwilioMessage[]>([]);
	const [status, setStatus] = useState<string>("Initializing...");
	const [input, setInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const clientRef = useRef<Client | null>(null);
	const conversationRef = useRef<TwilioConversation | null>(null);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	// Initialize Twilio client and connect to conversation
	useEffect(() => {
		let isMounted = true;

		fetch("/api/twilio/token")
			.then(async (res) => {
				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					const msg = (() => {
						if (typeof data === "object" && data !== null && "error" in data) {
							const maybeError = (data as { error?: unknown }).error;
							if (typeof maybeError === "string") return maybeError;
						}
						return `HTTP ${res.status}`;
					})();
					throw new Error(msg);
				}
				return data as { token?: unknown };
			})
			.then(({ token }) => {
				if (typeof token !== "string" || token.trim().length === 0) {
					throw new Error("Twilio token endpoint returned no token");
				}
				const normalizedToken = token.trim();
				if (normalizedToken.split(".").length < 3) {
					throw new Error("Twilio token looks malformed (expected JWT)");
				}

				const client = new Client(normalizedToken);
				clientRef.current = client;

				client.on("initialized", async () => {
					if (!isMounted) return;
					setStatus("Connecting to conversation...");
					console.log("Twilio Conversations client initialized");

					try {
						// First, check subscribed conversations
						let conversation: TwilioConversation | null = null;

						try {
							const subscribedConversations =
								await client.getSubscribedConversations();
							const items = subscribedConversations.items || [];
							conversation =
								items.find(
									(conv) => conv.uniqueName === MAIN_CONVERSATION_UNIQUE_NAME,
								) || null;

							if (conversation) {
								console.log("Found conversation in subscribed list");
							}
						} catch (error) {
							console.log("Error getting subscribed conversations:", error);
						}

						// If not in subscribed list, try to get by unique name
						if (!conversation) {
							try {
								conversation = await client.getConversationByUniqueName(
									MAIN_CONVERSATION_UNIQUE_NAME,
								);
								console.log("Found existing conversation by unique name");
							} catch (getError) {
								const errorMessage =
									getError instanceof Error
										? getError.message
										: String(getError);
								console.log("Get conversation error:", errorMessage);

								// If Forbidden, the conversation might exist but we don't have access
								// Try to create it (which will fail if it exists, but might work if permissions allow)
								if (
									errorMessage.includes("Forbidden") ||
									errorMessage.includes("403")
								) {
									console.log(
										"Forbidden error, attempting to create conversation",
									);
									try {
										conversation = await client.createConversation({
											uniqueName: MAIN_CONVERSATION_UNIQUE_NAME,
											friendlyName: "Main Conversation",
										});
										console.log("Created new conversation");
									} catch (createError) {
										const createErrorMessage =
											createError instanceof Error
												? createError.message
												: String(createError);

										// If creation also fails with Forbidden, we don't have permission
										if (
											createErrorMessage.includes("Forbidden") ||
											createErrorMessage.includes("403")
										) {
											throw new Error(
												"Permission denied: Cannot access or create conversation. Check token permissions.",
											);
										}

										// If conflict, try to get it again
										if (
											createErrorMessage.includes("Conflict") ||
											createErrorMessage.includes("50300")
										) {
											console.log("Creation conflict, retrying get");
											conversation = await client.getConversationByUniqueName(
												MAIN_CONVERSATION_UNIQUE_NAME,
											);
										} else {
											throw createError;
										}
									}
								} else {
									// For other errors (like not found), try to create
									console.log("Conversation not found, creating new one");
									try {
										conversation = await client.createConversation({
											uniqueName: MAIN_CONVERSATION_UNIQUE_NAME,
											friendlyName: "Main Conversation",
										});
										console.log("Created new conversation");
									} catch (createError) {
										const createErrorMessage =
											createError instanceof Error
												? createError.message
												: String(createError);

										if (
											createErrorMessage.includes("Conflict") ||
											createErrorMessage.includes("50300")
										) {
											console.log("Creation conflict, retrying get");
											conversation = await client.getConversationByUniqueName(
												MAIN_CONVERSATION_UNIQUE_NAME,
											);
										} else {
											throw createError;
										}
									}
								}
							}
						}

						if (!conversation) {
							throw new Error("Failed to get or create conversation");
						}

						conversationRef.current = conversation;

						// Check if we're already a participant before joining
						let isParticipant = false;
						try {
							const participants = await conversation.getParticipants();
							const userIdentity = client.user?.identity;
							isParticipant = participants.some(
								(p) => p.identity === userIdentity,
							);
						} catch (error) {
							const errorMessage =
								error instanceof Error ? error.message : String(error);
							console.log("Error checking participants:", errorMessage);
							// If Forbidden, we might not have permission to check participants
							// but we can still try to join
							if (
								errorMessage.includes("Forbidden") ||
								errorMessage.includes("403")
							) {
								console.log(
									"Cannot check participants (Forbidden), will attempt join",
								);
							}
						}

						// Join the conversation only if not already a participant
						if (!isParticipant) {
							try {
								await conversation.join();
								console.log("Joined conversation");
							} catch (error) {
								const errorMessage =
									error instanceof Error ? error.message : String(error);
								console.log("Join attempt result:", errorMessage);

								// If Forbidden, we don't have permission to join
								if (
									errorMessage.includes("Forbidden") ||
									errorMessage.includes("403")
								) {
									throw new Error(
										"Permission denied: Cannot join conversation. Check token permissions and conversation access.",
									);
								}

								// If it's an "already joined" or conflict error, continue
								if (
									errorMessage.includes("already") ||
									errorMessage.includes("Conflict")
								) {
									console.log("Join skipped (already joined or conflict)");
								} else {
									// For other errors, throw to surface the issue
									throw error;
								}
							}
						} else {
							console.log("Already a participant, skipping join");
						}

						// Load initial messages
						try {
							const messagesPaginator = await conversation.getMessages();
							const initialMessages = messagesPaginator.items || [];
							if (isMounted) {
								setMessages(initialMessages);
							}
						} catch (error) {
							console.error("Error loading messages:", error);
							// Continue anyway - messages will come through events
							if (isMounted) {
								setMessages([]);
							}
						}

						if (isMounted) {
							setStatus("Connected");
						}

						// Set up message listeners
						conversation.on("messageAdded", (message: TwilioMessage) => {
							if (isMounted) {
								setMessages((prev) => [...prev, message]);
							}
						});

						conversation.on("messageRemoved", (message: TwilioMessage) => {
							if (isMounted) {
								setMessages((prev) =>
									prev.filter((m) => m.sid !== message.sid),
								);
							}
						});

						conversation.on(
							"messageUpdated",
							({ message }: { message: TwilioMessage }) => {
								if (isMounted) {
									setMessages((prev) =>
										prev.map((m) => (m.sid === message.sid ? message : m)),
									);
								}
							},
						);

						// Also listen to client-level messageAdded for all conversations
						client.on("messageAdded", (message: TwilioMessage) => {
							if (isMounted && message.conversation?.sid === conversation.sid) {
								setMessages((prev) => {
									// Avoid duplicates
									if (prev.some((m) => m.sid === message.sid)) {
										return prev;
									}
									return [...prev, message];
								});
							}
						});
					} catch (error) {
						console.error("Error connecting to conversation:", error);
						if (isMounted) {
							setStatus(
								`Error: ${
									error instanceof Error ? error.message : String(error)
								}`,
							);
						}
					}
				});

				client.on("initFailed", ({ error }) => {
					if (!isMounted) return;
					setStatus(
						`Init failed: ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
					console.error("Error initializing Twilio Conversations:", error);
				});

				client.on("connectionError", ({ message }) => {
					if (!isMounted) return;
					setStatus(`Connection error: ${message}`);
					console.error("Twilio connection error:", message);
				});
			})
			.catch((error) => {
				if (!isMounted) return;
				setStatus(
					`Init failed: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
				console.error("Error initializing Twilio Conversations:", error);
			});

		return () => {
			isMounted = false;
			if (conversationRef.current) {
				conversationRef.current.removeAllListeners();
			}
			if (clientRef.current) {
				clientRef.current.removeAllListeners();
				clientRef.current.shutdown().catch(console.error);
			}
		};
	}, []);

	const handleSend = useCallback(async () => {
		const text = input.trim();
		if (!text || isSending || !conversationRef.current) return;

		setIsSending(true);
		try {
			await conversationRef.current.sendMessage(text);
			setInput("");
		} catch (error) {
			console.error("Error sending message:", error);
			alert(
				`Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			setIsSending(false);
		}
	}, [input, isSending]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	return (
		<div className="h-screen w-full flex flex-col bg-zinc-950 text-white overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
				<div className="flex items-center gap-3">
					<WhatsappLogo className="w-6 h-6 text-green-500" weight="fill" />
					<div>
						<h1 className="text-lg font-semibold">Main Conversation</h1>
						<p className="text-xs text-zinc-400">{status}</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Circle
						className={`w-2 h-2 ${
							status === "Connected" ? "text-green-500" : "text-yellow-500"
						}`}
						weight="fill"
					/>
				</div>
			</div>

			{/* Messages Area */}
			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
				{messages.length === 0 ? (
					<div className="flex items-center justify-center h-full text-zinc-500">
						<p>No messages yet. Start the conversation!</p>
					</div>
				) : (
					messages.map((message) => {
						const isFromMe =
							message.author === clientRef.current?.user?.identity;
						return (
							<div
								key={message.sid}
								className={`flex ${isFromMe ? "justify-end" : "justify-start"}`}
							>
								<div
									className={`max-w-[70%] rounded-lg px-4 py-2 ${
										isFromMe
											? "bg-green-600 text-white"
											: "bg-zinc-800 text-zinc-100"
									}`}
								>
									{!isFromMe && message.author && (
										<div className="text-xs font-semibold mb-1 opacity-80">
											{message.author}
										</div>
									)}
									{message.body && (
										<div className="prose prose-invert prose-sm max-w-none">
											<MemoizedMarkdown
												content={message.body}
												id={message.sid}
											/>
										</div>
									)}
									<div className="text-xs mt-1 opacity-70">
										{new Date(message.dateCreated || 0).toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</div>
								</div>
							</div>
						);
					})
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Input Area */}
			<div className="border-t border-zinc-800 bg-zinc-900/50 p-4">
				<div className="flex gap-2 items-end">
					<Textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type a message..."
						className="flex-1 min-h-[60px] max-h-[120px] resize-none bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
						disabled={isSending || status !== "Connected"}
					/>
					<Button
						onClick={handleSend}
						disabled={!input.trim() || isSending || status !== "Connected"}
						variant="primary"
						className="h-[60px] px-4"
					>
						<PaperPlaneTilt className="w-5 h-5" weight="fill" />
					</Button>
				</div>
			</div>
		</div>
	);
}
