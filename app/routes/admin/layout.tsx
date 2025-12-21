import { Shield } from "@phosphor-icons/react";
import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { ADMIN_USER_IDS } from "~/config/constants";
import { authClient } from "~/lib/auth-client";

type AdminUser = {
	id: string;
	email: string;
	name: string;
	role?: string;
	image?: string;
};

export default function AdminLayout() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const navigate = useNavigate();

	// Check auth and admin status
	useEffect(() => {
		if (sessionLoading) return;

		if (!session?.user) {
			navigate("/login");
			return;
		}

		const user = session.user as unknown as AdminUser;
		if (user.role !== "admin" && !ADMIN_USER_IDS.includes(user.id)) {
			navigate("/");
			return;
		}
	}, [session, sessionLoading, navigate]);

	if (sessionLoading) {
		return (
			<div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
				<div className="text-gray-400">Loading...</div>
			</div>
		);
	}

	const currentUser = session?.user as unknown as AdminUser;

	// If not authorized yet (or failed), show loading or nothing (useEffect will redirect)
	if (!currentUser) return null;

	return (
		<div className="min-h-screen bg-[#0a0a0a] text-white">
			<nav className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 justify-between items-center">
						<div className="flex items-center gap-2">
							<Shield className="w-8 h-8 text-indigo-500" weight="fill" />
							<span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
								Gnar Dawgs Admin
							</span>
						</div>
						<div className="flex items-center gap-6">
							<div className="text-sm font-medium text-gray-400">
								<span className="hidden sm:inline">Admin:</span>{" "}
								{currentUser.email}
							</div>
							<Link
								to="/"
								className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
							>
								Home
							</Link>
						</div>
					</div>
				</div>
			</nav>

			<main className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
				<Outlet />
			</main>

			<footer className="mt-auto py-8 border-t border-white/5 bg-black/20">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-sm text-gray-600">
					<div>&copy; 2025 Gnar Dawgs Inc.</div>
					<div className="flex gap-6">
						<Link to="/" className="hover:text-gray-400 transition-colors">
							Support
						</Link>
						<Link to="/" className="hover:text-gray-400 transition-colors">
							Privacy
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}
