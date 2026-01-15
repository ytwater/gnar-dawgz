import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { Layout } from "~/app/components/layout";
import { ADMIN_USER_IDS } from "~/app/config/constants";
import { authClient } from "~/app/lib/auth-client";

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
			<Layout>
				<div className="flex items-center justify-center min-h-[60vh]">
					<div className="text-muted-foreground">Loading...</div>
				</div>
			</Layout>
		);
	}

	const currentUser = session?.user as unknown as AdminUser;

	// If not authorized yet (or failed), show loading or nothing (useEffect will redirect)
	if (!currentUser) return null;

	return (
		<Layout>
			<Outlet />
		</Layout>
	);
}
