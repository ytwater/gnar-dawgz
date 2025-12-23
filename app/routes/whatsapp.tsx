import {
	Circle,
	DotsThreeVertical,
	PaperPlaneTilt,
	UserCircle,
	WhatsappLogo,
} from "@phosphor-icons/react";
import {
	Client,
	type Conversation as TwilioConversation,
	type Message as TwilioMessage,
} from "@twilio/conversations";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/button/Button";
import { MemoizedMarkdown } from "~/components/memoized-markdown";
import { Textarea } from "~/components/textarea/Textarea";
import { authClient } from "~/lib/auth-client";

export const handle = {
	hydrate: false,
};

type Conversation = {
	sid: string;
	friendlyName: string | null;
	uniqueName: string | null;
	dateCreated: Date;
	dateUpdated: Date;
	state: string;
	attributes: string;
};

type Message = {
	sid: string;
	index: number | null;
	author: string | null;
	body: string | null;
	dateCreated: Date;
	dateUpdated: Date;
	attributes: string;
};

type ConversationResponse = {
	sid: string;
	friendlyName: string | null;
	uniqueName: string | null;
	dateCreated: string;
	dateUpdated: string;
	state: string;
	attributes: string;
};

type MessageResponse = {
	sid: string;
	index: number | null;
	author: string | null;
	body: string | null;
	dateCreated: string;
	dateUpdated: string;
	attributes: string;
};

export default function WhatsAppChat() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const navigate = useNavigate();
	const [activeConversation, setActiveConversation] =
		useState<Conversation | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [status, setStatus] = useState<string>("Initializing...");
	const [input, setInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const activeConversationRef = useRef<Conversation | null>(null);
	const pollIntervalRef = useRef<number | null>(null);
	const clientRef = useRef<Client | null>(null);
	const twilioConversationRef = useRef<TwilioConversation | null>(null);
	const MAIN_CONVERSATION_UNIQUE_NAME = "main";

	useEffect(() => {
		activeConversationRef.current = activeConversation;
	}, [activeConversation]);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Auth check
	useEffect(() => {
		if (!sessionLoading && !session) {
			navigate("/login");
		}
	}, [session, sessionLoading, navigate]);

	// Initialize Twilio client and load/create conversation
	useEffect(() => {
		if (!session) return;

		let isMounted = true;

		const initializeTwilio = async () => {
			try {
				setStatus("Initializing...");

				// Get token from backend
				const tokenRes = await fetch("/api/twilio/token");
				if (!tokenRes.ok) {
					throw new Error("Failed to get Twilio token");
				}
				const { token } = await tokenRes.json();

				// Initialize Twilio client
				const client = await Client.create(token);
				if (!isMounted) {
					client.shutdown();
					return;
				}
				clientRef.current = client;

				setStatus("Loading conversation...");

				// Ensure conversation exists via REST API
				let mainConv: Conversation | null = null;
				const res = await fetch(
					`/api/twilio/conversations?uniqueName=${MAIN_CONVERSATION_UNIQUE_NAME}`,
				);

				if (res.ok) {
					const data = await res.json();
					mainConv = {
						...data,
						dateCreated: new Date(data.dateCreated),
						dateUpdated: new Date(data.dateUpdated),
					};
				} else if (res.status === 404) {
					setStatus("Creating conversation...");
					const createRes = await fetch("/api/twilio/conversations", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							friendlyName: "Main Chat",
							uniqueName: MAIN_CONVERSATION_UNIQUE_NAME,
						}),
					});

					if (!createRes.ok) {
						const errorText = await createRes.text();
						throw new Error(`Failed to create conversation: ${errorText}`);
					}

					const createData = await createRes.json();
					mainConv = {
						...createData.conversation,
						dateCreated: new Date(createData.conversation.dateCreated),
						dateUpdated: new Date(createData.conversation.dateUpdated),
					};
				} else {
					throw new Error(`Failed to fetch conversation: ${res.status}`);
				}

				if (!mainConv?.sid) {
					throw new Error("Conversation does not have a valid sid");
				}

				// Connect to conversation via SDK
				const twilioConv = await client.getConversationBySid(mainConv.sid);
				if (!isMounted) {
					return;
				}
				twilioConversationRef.current = twilioConv;

				// Set up real-time message listeners
				twilioConv.on("messageAdded", (message: TwilioMessage) => {
					if (!isMounted) return;

					const newMsg: Message = {
						sid: message.sid,
						index: message.index,
						author: message.author || null,
						body: message.body || null,
						dateCreated: message.dateCreated || new Date(),
						dateUpdated: message.dateUpdated || new Date(),
						attributes: JSON.stringify(message.attributes || {}),
					};

					setMessages((prev) => {
						// Avoid duplicates
						if (prev.some((m) => m.sid === newMsg.sid)) {
							return prev;
						}
						const updated = [...prev, newMsg];
						updated.sort(
							(a, b) => a.dateCreated.getTime() - b.dateCreated.getTime(),
						);
						return updated;
					});
				});

				// Load initial messages
				const initialMessages = await twilioConv.getMessages();
				const msgs: Message[] = initialMessages.items.map(
					(msg: TwilioMessage) => ({
						sid: msg.sid,
						index: msg.index,
						author: msg.author || null,
						body: msg.body || null,
						dateCreated: msg.dateCreated || new Date(),
						dateUpdated: msg.dateUpdated || new Date(),
						attributes: JSON.stringify(msg.attributes || {}),
					}),
				);
				msgs.sort((a, b) => a.dateCreated.getTime() - b.dateCreated.getTime());

				if (isMounted) {
					setActiveConversation(mainConv);
					setMessages(msgs);
					setStatus("Connected");
				}
			} catch (error) {
				console.error("Error initializing Twilio:", error);
				if (isMounted) {
					setStatus(
						"Error: " +
							(error instanceof Error ? error.message : "Unknown error"),
					);
				}
			}
		};

		initializeTwilio();

		return () => {
			isMounted = false;
			if (twilioConversationRef.current) {
				twilioConversationRef.current.removeAllListeners();
				twilioConversationRef.current = null;
			}
			if (clientRef.current) {
				clientRef.current.shutdown();
				clientRef.current = null;
			}
		};
	}, [session]);

	// Messages are now loaded via SDK in the initialization effect
	// This effect is kept for scroll behavior only

	useEffect(() => {
		if (messages.length > 0) {
			scrollToBottom();
		}
	}, [messages, scrollToBottom]);

	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || !activeConversation || isSending) return;

		const twilioConv = twilioConversationRef.current;
		if (!twilioConv) {
			console.error("Twilio conversation not initialized");
			setStatus("Error: Not connected");
			return;
		}

		const messageBody = input.trim();
		if (!messageBody) {
			return;
		}

		setIsSending(true);
		try {
			// Send message via SDK (real-time)
			await twilioConv.sendMessage(messageBody);
			setInput("");
			// Message will be added via the messageAdded event listener
		} catch (error) {
			console.error("Send Message Error:", error);
			setStatus(
				error instanceof Error ? error.message : "Error sending message",
			);
		} finally {
			setIsSending(false);
		}
	};

	if (sessionLoading || !session) {
		return (
			<div className="h-screen flex items-center justify-center bg-zinc-950 text-white">
				Loading...
			</div>
		);
	}

	return (
		<div className="h-screen w-full flex bg-zinc-950 text-white overflow-hidden">
			{/* Main Chat Area */}
			<div className="flex-1 flex flex-col relative">
				{activeConversation ? (
					<>
						{/* Chat Header */}
						<div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
									<WhatsappLogo size={24} weight="fill" />
								</div>
								<div>
									<h2 className="font-semibold">
										{activeConversation.friendlyName || "Main Chat"}
									</h2>
									<div className="flex items-center gap-1 text-xs text-zinc-500">
										<Circle
											size={6}
											weight="fill"
											className={
												status === "Connected"
													? "text-green-500"
													: "text-amber-500"
											}
										/>
										{status}
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="ghost"
									size="md"
									shape="square"
									className="rounded-full"
								>
									<DotsThreeVertical size={20} />
								</Button>
							</div>
						</div>

						{/* Messages */}
						<div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 scroll-smooth bg-[url('https://w0.peakpx.com/wallpaper/580/671/HD-wallpaper-whatsapp-background-dark-original-minimal-simple-whatsapp-patter.jpg')] bg-repeat bg-contain">
							<div className="flex flex-col gap-2">
								{messages.map((msg) => {
									const isMe = msg.author === session.user.email;
									return (
										<div
											key={msg.sid}
											className={`flex ${isMe ? "justify-end" : "justify-start"}`}
										>
											<div
												className={`max-w-[80%] p-3 rounded-lg shadow-sm ${
													isMe
														? "bg-green-700 text-white rounded-br-none"
														: "bg-zinc-800 text-zinc-100 rounded-bl-none"
												}`}
											>
												<MemoizedMarkdown
													id={msg.sid}
													content={msg.body || ""}
												/>
												<p className="text-[10px] opacity-50 mt-1 text-right">
													{msg.dateCreated instanceof Date
														? msg.dateCreated.toLocaleTimeString([], {
																hour: "2-digit",
																minute: "2-digit",
															})
														: new Date(msg.dateCreated).toLocaleTimeString([], {
																hour: "2-digit",
																minute: "2-digit",
															})}
												</p>
											</div>
										</div>
									);
								})}
								<div ref={messagesEndRef} />
							</div>
						</div>

						{/* Input */}
						<div className="p-4 bg-zinc-950 border-t border-zinc-800 sticky bottom-0">
							<form
								onSubmit={handleSendMessage}
								className="max-w-4xl mx-auto flex items-end gap-2"
							>
								<div className="flex-1 relative">
									<Textarea
										placeholder="Type a message..."
										value={input}
										onChange={(e) => setInput(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !e.shiftKey) {
												e.preventDefault();
												handleSendMessage(e);
											}
										}}
										className="w-full bg-zinc-900 border-zinc-700 rounded-2xl resize-none py-3 px-4 focus:ring-green-600 focus:border-green-600 min-h-[48px] max-h-32"
									/>
								</div>
								<Button
									type="submit"
									disabled={!input.trim() || isSending}
									className="bg-green-600 hover:bg-green-700 text-white rounded-full p-3 h-12 w-12 flex items-center justify-center shrink-0"
								>
									<PaperPlaneTilt size={24} weight="fill" />
								</Button>
							</form>
						</div>
					</>
				) : (
					<div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
						<div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4 text-zinc-700">
							<WhatsappLogo size={48} weight="fill" />
						</div>
						<h2 className="text-2xl font-bold mb-2">WhatsApp for Gnar Dawgs</h2>
						<p className="text-zinc-500 max-w-md">{status}</p>
						<div className="mt-8 flex items-center gap-2 text-sm text-zinc-600">
							<UserCircle size={20} />
							Logged in as {session.user.email}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
