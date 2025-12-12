import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";

export function meta(_: Route.MetaArgs) {
	return [
		{ title: "Gnar Dawgs" },
		{ name: "description", content: "Welcome to Gnar Dawgs!" },
	];
}

export default function Home() {
	return <Welcome />;
}
