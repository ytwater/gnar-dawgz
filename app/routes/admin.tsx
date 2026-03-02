import { Outlet } from "react-router";
import { Layout } from "~/app/components/layout";
import { requireAdmin } from "~/app/lib/auth";
import { authClient } from "~/app/lib/auth-client";
import type { Route } from "./+types/admin";

export async function loader({ request, context }: Route.LoaderArgs) {
	return await requireAdmin(request, context.cloudflare.env);
}

export default function AdminLayout() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();

	if (sessionLoading) {
		return (
			<Layout>
				<div className="flex items-center justify-center min-h-[60vh]">
					<div className="text-muted-foreground">Loading...</div>
				</div>
			</Layout>
		);
	}

	// If the loader passes, we know user is an admin.
	// We check session client-side just to be safe during hydration.
	if (!session?.user) return null;

	return (
		<Layout>
			<Outlet />
		</Layout>
	);
}
