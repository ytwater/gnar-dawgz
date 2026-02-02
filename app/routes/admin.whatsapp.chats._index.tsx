import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
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
import { WAHA_SESSION_NAME } from "~/app/config/constants";
import type { ChatSummary } from "~/app/lib/whatsapp/models";
import { chatsControllerGetChats } from "~/app/lib/whatsapp/whatsapp-api";

interface ExtendedChatSummary extends ChatSummary {
	unreadCount?: number;
}

/** WAHA can return id as object { server, user, _serialized }; normalize to string. */
function chatIdDisplay(
	id: string | { server?: string; user?: string; _serialized?: string },
): string {
	if (typeof id === "string") return id;
	return (id as { _serialized?: string })._serialized ?? JSON.stringify(id);
}

export const loader = async ({ context }: LoaderFunctionArgs) => {
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
		const chatsRes = await chatsControllerGetChats(
			{},
			WAHA_SESSION_NAME,
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
							<TableHead className="w-24 text-center">Unread</TableHead>
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
								<TableRow
									key={chatIdDisplay(chat.id)}
									className="cursor-pointer hover:bg-muted/50 transition-colors"
								>
									<TableCell className="font-medium">
										<Link
											to={`/admin/whatsapp/chats/${encodeURIComponent(chatIdDisplay(chat.id))}`}
											className="block hover:underline"
										>
											{chat.name || "Unknown"}
										</Link>
									</TableCell>
									<TableCell
										className="font-mono text-xs truncate"
										title={chatIdDisplay(chat.id)}
									>
										{chatIdDisplay(chat.id)}
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
