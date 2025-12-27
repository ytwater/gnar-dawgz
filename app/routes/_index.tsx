import { Layout } from "~/app/components/layout";
import type { Route } from "./+types/_index";

export function meta(_: Route.MetaArgs) {
	return [
		{ title: "Gnar Dawgs" },
		{ name: "description", content: "Welcome to Gnar Dawgs!" },
	];
}

export default function Home() {
	return (
		<main className="flex items-center justify-center min-h-screen bg-slate-500">
			<img
				src="/gnar-dawgs-logo-transparent.webp"
				alt="Gnar Dawgs Logo"
				className="block w-full max-w-[700px] h-auto px-4"
				loading="eager"
				fetchPriority="high"
				decoding="sync"
			/>
		</main>
	);
}
