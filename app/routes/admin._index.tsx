import {
	Broadcast,
	CaretRight,
	ChatCircle,
	Key,
	Users,
} from "@phosphor-icons/react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { authClient } from "~/lib/auth-client";

type AdminUser = {
	id: string;
	email: string;
	name: string;
	role?: string;
	image?: string;
};

export default function AdminDashboard() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const navigate = useNavigate();

	// Check auth and admin status - mostly handled by layout but good for direct access safety
	useEffect(() => {
		if (sessionLoading) return;

		if (!session?.user) {
			navigate("/login");
			return;
		}
	}, [session, sessionLoading, navigate]);

	if (sessionLoading) {
		return (
			<div className="flex items-center justify-center p-12">
				<div className="text-gray-400">Loading dashboard...</div>
			</div>
		);
	}

	const currentUser = session?.user as unknown as AdminUser;

	// Fallback if session is missing (should not happen due to layout/useEffect)
	if (!currentUser) return null;

	const menuItems = [
		{
			title: "User Management",
			description: "View and manage user roles, bans, and permissions.",
			icon: Users,
			href: "/admin/users",
			color: "text-indigo-500",
			bgColor: "bg-indigo-500/10",
		},
		{
			title: "Access Requests",
			description: "Review and approve/reject new access requests.",
			icon: Key,
			href: "/admin/approve-access",
			color: "text-emerald-500",
			bgColor: "bg-emerald-500/10",
		},
		{
			title: "WhatsApp Participants",
			description: "Manage participants in the main WhatsApp chat.",
			icon: ChatCircle,
			href: "/admin/whatsapp",
			color: "text-cyan-500",
			bgColor: "bg-cyan-500/10",
		},
		{
			title: "Twilio Event Sync",
			description: "Manage Twilio event subscriptions and sync configuration.",
			icon: Broadcast,
			href: "/admin/twilio-event-sync",
			color: "text-purple-500",
			bgColor: "bg-purple-500/10",
		},
	];

	return (
		<div className="space-y-8">
			{/* Header Section */}
			<div>
				<h1 className="text-4xl font-extrabold tracking-tight">Dashboard</h1>
				<p className="mt-2 text-gray-400">
					Welcome back, {currentUser.name || "Admin"}. Select a module to begin.
				</p>
			</div>

			{/* Dashboard Actions */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{menuItems.map((item) => (
					<Link
						key={item.href}
						to={item.href}
						className="group relative bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10"
					>
						<div className="flex items-start justify-between">
							<div className={`p-4 rounded-xl ${item.bgColor} mb-6`}>
								<item.icon className={`w-8 h-8 ${item.color}`} />
							</div>
							<div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
								<CaretRight className="w-6 h-6 text-gray-400" />
							</div>
						</div>
						<h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
						<p className="text-gray-400 leading-relaxed">{item.description}</p>
					</Link>
				))}
			</div>
		</div>
	);
}
