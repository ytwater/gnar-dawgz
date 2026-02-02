import { useEffect, useRef } from "react";
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	data,
} from "react-router";
import {
	Form,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { Input } from "~/app/components/ui/input";
import { ScrollArea } from "~/app/components/ui/scroll-area";
import { WAHA_SESSION_NAME } from "~/app/config/constants";
import { cn } from "~/app/lib/utils";
import { sendWahaMessage } from "~/app/lib/waha/client";
import { chatsControllerGetChatMessages } from "~/app/lib/whatsapp/whatsapp-api";

export const loader = async ({ params, context }: LoaderFunctionArgs) => {
	const { chatId } = params;
	if (!chatId) throw new Error("Chat ID is required");

	const env = context.cloudflare.env;
	const apiKey = env.WAHA_API_KEY;

	if (!apiKey) {
		return { error: "WAHA_API_KEY is not configured" };
	}

	const fetchOptions = {
		headers: {
			"X-Api-Key": apiKey,
		},
	};

	try {
		const messagesRes = await chatsControllerGetChatMessages(
			chatId,
			{ limit: 50 },
			WAHA_SESSION_NAME,
			fetchOptions,
		);

		return {
			chatId,
			messages: Array.isArray(messagesRes.data) ? messagesRes.data : [],
		};
	} catch (error) {
		console.error("Chat Detail Loader Error:", error);
		return { error: "Failed to fetch messages" };
	}
};

export const action = async ({
	params,
	request,
	context,
}: ActionFunctionArgs) => {
	const { chatId } = params;
	if (!chatId) throw new Error("Chat ID is required");

	const formData = await request.formData();
	const text = formData.get("text") as string;

	if (!text || text.trim().length === 0) {
		return data({ error: "Message text is required" }, { status: 400 });
	}

	const env = context.cloudflare.env;
	const apiKey = env.WAHA_API_KEY;

	if (!apiKey) {
		return data({ error: "WAHA_API_KEY is not configured" }, { status: 500 });
	}

	const fetchOptions = {
		headers: {
			"X-Api-Key": apiKey,
			"Content-Type": "application/json",
		},
	};

	try {
		await sendWahaMessage(env, chatId, text);
		return { success: true };
	} catch (error) {
		console.error("Send Message Action Error:", error);
		return data({ error: "Failed to send message" }, { status: 500 });
	}
};

export default function AdminWhatsAppChatDetail() {
	const loaderData = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const scrollRef = useRef<HTMLDivElement>(null);
	const formRef = useRef<HTMLFormElement>(null);

	const isSending = navigation.state === "submitting";

	if ("error" in loaderData) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p className="text-destructive">{loaderData.error}</p>
				</CardContent>
			</Card>
		);
	}

	const { messages, chatId } = loaderData;

	useEffect(() => {
		if (scrollRef.current && messages.length > 0) {
			const scrollContainer = scrollRef.current.querySelector(
				"[data-radix-scroll-area-viewport]",
			);
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		}
	}, [messages]);

	useEffect(() => {
		if (!isSending && actionData && "success" in actionData) {
			formRef.current?.reset();
		}
	}, [isSending, actionData]);

	return (
		<Card className="flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
			<CardHeader className="border-b">
				<CardTitle className="text-lg">Chat with {chatId}</CardTitle>
				<CardDescription>WhatsApp Conversation</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 min-h-0 p-0">
				<ScrollArea className="h-full p-4" ref={scrollRef}>
					<div className="flex flex-col gap-3">
						{messages.length === 0 ? (
							<p className="text-center text-muted-foreground py-8">
								No messages found.
							</p>
						) : (
							messages.map((msg) => (
								<div
									key={msg.id}
									className={cn(
										"flex flex-col max-w-[80%] rounded-lg p-3 text-sm",
										msg.fromMe
											? "self-end bg-primary text-primary-foreground"
											: "self-start bg-muted text-muted-foreground",
									)}
								>
									<p className="whitespace-pre-wrap">{msg.body}</p>
									<span className="text-[10px] mt-1 opacity-70 self-end">
										{new Date(msg.timestamp * 1000).toLocaleTimeString()}
									</span>
								</div>
							))
						)}
					</div>
				</ScrollArea>
			</CardContent>
			<CardFooter className="border-t p-4">
				<Form
					ref={formRef}
					method="post"
					className="flex w-full items-center space-x-2"
				>
					<Input
						name="text"
						placeholder="Type a message..."
						autoComplete="off"
						required
						disabled={isSending}
						className="flex-1"
					/>
					<Button type="submit" disabled={isSending}>
						{isSending ? "Sending..." : "Send"}
					</Button>
				</Form>
			</CardFooter>
		</Card>
	);
}
