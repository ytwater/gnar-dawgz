import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
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
import type { GroupInfo } from "~/app/lib/whatsapp/models";
import { groupsControllerGetGroups } from "~/app/lib/whatsapp/whatsapp-api";

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
		const groupsRes = await groupsControllerGetGroups(
			{},
			sessionName,
			fetchOptions,
		);
		const raw = groupsRes.data as unknown;
		const groups: GroupInfo[] = Array.isArray(raw)
			? raw
			: Array.isArray((raw as { groups?: unknown })?.groups)
				? (raw as { groups: GroupInfo[] }).groups
				: Array.isArray((raw as { data?: unknown })?.data)
					? (raw as { data: GroupInfo[] }).data
					: [];
		return { groups };
	} catch (error) {
		console.error("Groups Loader Error:", error);
		return { error: "Failed to fetch groups" };
	}
};

export default function AdminWhatsAppGroups() {
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

	const groups = Array.isArray(dataRaw.groups) ? dataRaw.groups : [];

	return (
		<Card className="w-full min-w-0 overflow-hidden">
			<CardHeader>
				<CardTitle>WhatsApp Groups</CardTitle>
				<CardDescription>Groups this account is a member of.</CardDescription>
			</CardHeader>
			<CardContent>
				<Table className="table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead className="w-[50%]">Group Name</TableHead>
							<TableHead className="w-[200px]">ID</TableHead>
							<TableHead className="w-24">Participants</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{groups.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={3}
									className="text-center py-8 text-muted-foreground"
								>
									No groups found.
								</TableCell>
							</TableRow>
						) : (
							groups.map((group) => (
								<TableRow key={group.id}>
									<TableCell className="font-medium">
										{group.subject || "Unnamed Group"}
									</TableCell>
									<TableCell
										className="font-mono text-xs truncate"
										title={group.id}
									>
										{group.id}
									</TableCell>
									<TableCell>
										{group.participants?.length || 0} members
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
