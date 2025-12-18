import { authClient } from "~/lib/auth-client";
import { Welcome } from "../welcome/welcome";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
	return [
		{ title: "Gnar Dawgs" },
		{ name: "description", content: "Welcome to Gnar Dawgs!" },
	];
}

export default function Home() {
	const session = authClient.useSession();
	console.log("🚀 ~ home.tsx:14 ~ Home ~ session:", session);
	return <Welcome />;
}
