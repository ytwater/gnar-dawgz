import {
	Broadcast,
	CaretRight,
	Key,
	Scales,
	Users,
} from "@phosphor-icons/react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { Skeleton } from "~/app/components/ui/skeleton";
import { authClient } from "~/app/lib/auth-client";

type AdminUser = {
	id: string;
	email: string;
	name: string;
	role?: string;
	image?: string;
};

const menuItems = [
	{
		title: "User Management",
		description: "View and manage user roles, bans, and permissions.",
		icon: Users,
		href: "/admin/users",
		color: "text-primary",
		bgColor: "bg-primary/10",
	},
	{
		title: "Access Requests",
		description: "Review and approve/reject new access requests.",
		icon: Key,
		href: "/admin/approve-access",
		color: "text-primary",
		bgColor: "bg-primary/10",
	},
	{
		title: "Twilio Event Sync",
		description: "Manage Twilio event subscriptions and sync configuration.",
		icon: Broadcast,
		href: "/admin/twilio-event-sync",
		color: "text-primary",
		bgColor: "bg-primary/10",
	},
	{
		title: "Surf Spots",
		description: "Configure and manage surf spots for forecast comparison.",
		icon: Broadcast,
		href: "/admin/surf-spots",
		color: "text-primary",
		bgColor: "bg-primary/10",
	},
	{
		title: "Global Charter",
		description: "Edit the rules members must live by and manage demerits.",
		icon: Scales,
		href: "/admin/charter",
		color: "text-red-600",
		bgColor: "bg-red-50",
	},
];

export default function AdminDashboard() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const navigate = useNavigate();

	useEffect(() => {
		if (sessionLoading) return;
		if (!session?.user) {
			navigate("/login");
		}
	}, [session, sessionLoading, navigate]);

	if (sessionLoading) {
		return (
			<div className="space-y-8">
				<div>
					<Skeleton className="h-10 w-48 mb-2" />
					<Skeleton className="h-5 w-64" />
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{menuItems.map((item) => (
						<Skeleton key={item.href} className="h-48" />
					))}
				</div>
			</div>
		);
	}

	const currentUser = session?.user as unknown as AdminUser;
	if (!currentUser) return null;

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-4xl font-extrabold tracking-tight">Dashboard</h1>
				<p className="mt-2 text-muted-foreground">
					Welcome back, {currentUser.name || "Admin"}. Select a module to begin.
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{menuItems.map((item) => {
					const Icon = item.icon;
					return (
						<Card
							key={item.href}
							className="group transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer"
						>
							<Link to={item.href} className="block">
								<CardHeader>
									<div className="flex items-start justify-between">
										<div className={`p-3 rounded-lg ${item.bgColor}`}>
											<Icon className={`w-6 h-6 ${item.color}`} />
										</div>
										<CaretRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
									</div>
									<CardTitle>{item.title}</CardTitle>
									<CardDescription>{item.description}</CardDescription>
								</CardHeader>
							</Link>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
