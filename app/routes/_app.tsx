import { Outlet } from "react-router";
import { Layout } from "~/app/components/layout";
export default function AppLayout() {
	return (
		<Layout>
			<Outlet />
		</Layout>
	);
}
