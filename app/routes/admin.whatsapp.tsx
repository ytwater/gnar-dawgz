import {
	ChatCircle,
	IdentificationCard,
	Info,
	Link,
	Users,
	WhatsappLogo,
} from "@phosphor-icons/react";
import type { LoaderFunctionArgs } from "react-router";
import { NavLink, Outlet, useLoaderData } from "react-router";
import { Badge } from "~/app/components/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { WAHA_SESSION_NAME } from "~/app/config/constants";
import type { SessionInfo } from "~/app/lib/whatsapp/models";
import { sessionsControllerGet } from "~/app/lib/whatsapp/whatsapp-api";

const navItems = [
	{
		to: "/admin/whatsapp",
		end: true,
		icon: IdentificationCard,
		label: "Profile",
	},
	{ to: "/admin/whatsapp/webhooks", end: false, icon: Link, label: "Webhooks" },
	{ to: "/admin/whatsapp/chats", end: false, icon: ChatCircle, label: "Chats" },
	{ to: "/admin/whatsapp/groups", end: false, icon: Users, label: "Groups" },
] as const;

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
		const sessionRes = await Promise.allSettled([
			sessionsControllerGet({}, WAHA_SESSION_NAME, fetchOptions),
		]);

		let isUnreachable = false;
		let session: SessionInfo | null = null;

		if (sessionRes[0].status === "rejected") {
			isUnreachable = true;
		} else {
			const res = sessionRes[0].value;
			if (res.status >= 500) {
				isUnreachable = true;
			} else if (res.status === 200) {
				session = res.data as SessionInfo;
			}
		}

		return { session, sessionName: WAHA_SESSION_NAME, isUnreachable };
	} catch (error) {
		console.error("WhatsApp Loader Error:", error);
		return { error: "Failed to fetch WhatsApp data" };
	}
};

export default function AdminWhatsAppLayout() {
	const data = useLoaderData<typeof loader>();

	if ("error" in data) {
		return (
			<div className="p-8">
				<Card className="border-destructive bg-destructive/5">
					<CardHeader>
						<CardTitle className="text-destructive flex items-center gap-2">
							<Info /> Configuration Error
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p>{data.error}. Please check your environment variables.</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const { session, sessionName, isUnreachable } = data;

	const statusText = isUnreachable
		? "UNREACHABLE"
		: session?.status || "UNKNOWN";

	return (
		<div className="space-y-8 p-6 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
						<WhatsappLogo className="text-green-500" weight="fill" />
						WhatsApp Integration
					</h1>
					<p className="text-muted-foreground mt-1">
						Manage WhatsApp session:{" "}
						<code className="bg-muted px-1 rounded">{sessionName}</code>
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge
						variant={
							statusText === "SCAN_QR_CODE" || statusText === "UNREACHABLE"
								? "destructive"
								: "outline"
						}
						className="px-3 py-1"
					>
						Status: {statusText}
					</Badge>
				</div>
			</div>

			<nav className="flex flex-wrap gap-1 border-b border-border pb-2">
				{navItems.map(({ to, end, icon: Icon, label }) => (
					<NavLink
						key={to}
						to={to}
						end={end}
						className={({ isActive }) =>
							`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
								isActive
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground"
							}`
						}
					>
						<Icon size={18} />
						{label}
					</NavLink>
				))}
			</nav>

			<Outlet />
		</div>
	);
}
