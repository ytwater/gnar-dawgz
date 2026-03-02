import { Outlet } from "react-router";
import { Layout } from "~/app/components/layout";
import { requireUser } from "~/app/lib/auth";
import type { Route } from "./+types/_app";

export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	if (url.pathname === "/request-access") {
		return null;
	}

	return await requireUser(request, context.cloudflare.env);
}

export default function AppLayout() {
	return (
		<Layout>
			<Outlet />
		</Layout>
	);
}
