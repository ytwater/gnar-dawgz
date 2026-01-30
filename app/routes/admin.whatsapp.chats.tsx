import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Badge } from "~/app/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/app/components/ui/table";
import type { ChatSummary } from "~/app/lib/whatsapp/models";
import { chatsControllerGetChats } from "~/app/lib/whatsapp/whatsapp-api";

interface ExtendedChatSummary extends ChatSummary {
	unreadCount?: number;
}

export const loader = async ({ context }: LoaderFunctionArgs) => {
	const env = context.cloudflare.env;
	const sessionName = env.WAHA_SESSION_ID || "default";
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
		const chatsRes = await chatsControllerGetChats(
			{},
			sessionName,
			fetchOptions,
		);
		const raw = chatsRes.data as unknown;
		const chats: ExtendedChatSummary[] = Array.isArray(raw)
			? raw
			: Array.isArray((raw as { chats?: unknown })?.chats)
				? (raw as { chats: ExtendedChatSummary[] }).chats
				: Array.isArray((raw as { data?: unknown })?.data)
					? (raw as { data: ExtendedChatSummary[] }).data
					: [];
		return { chats };
	} catch (error) {
		console.error("Chats Loader Error:", error);
		return { error: "Failed to fetch chats" };
	}
};

export default function AdminWhatsAppChats() {
	const dataRaw = useLoaderData<typeof loader>();

	if ("error" in dataRaw) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p className="text-destructive">{dataRaw.error}</p>
				</CardContent>
			</Card>
		);
	}

	const chats = Array.isArray(dataRaw.chats) ? dataRaw.chats : [];

	return (
		<Card className="w-full min-w-0 overflow-hidden">
			<CardHeader>
				<CardTitle>Active Chats</CardTitle>
				<CardDescription>
					Showing recent individual conversations.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table className="table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead className="w-[50%]">Chat Name</TableHead>
							<TableHead className="w-[200px]">ID (JID)</TableHead>
							<TableHead className="text-center w-20">Unread</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{chats.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={3}
									className="text-center py-8 text-muted-foreground"
								>
									No active chats found.
								</TableCell>
							</TableRow>
						) : (
							chats.map((chat) => (
								<TableRow key={chat.id}>
									<TableCell className="font-medium">
										{chat.name || "Unknown"}
									</TableCell>
									<TableCell
										className="font-mono text-xs truncate"
										title={chat.id}
									>
										{chat.id}
									</TableCell>
									<TableCell className="text-center">
										{(chat.unreadCount ?? 0) > 0 ? (
											<Badge variant="secondary">{chat.unreadCount}</Badge>
										) : (
											<span className="text-muted-foreground opacity-50">
												-
											</span>
										)}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
