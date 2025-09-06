import logo from "./gnar-dawgs-logo-transparent.webp";

export function Welcome({ message }: { message: string }) {
	return (
		<main className="flex items-center justify-center min-h-screen bg-slate-500">
			<img
				src={logo}
				alt="Gnar Dawgs Logo"
				className="block w-full max-w-[700px] h-auto px-4"
				loading="eager"
				fetchPriority="high"
				decoding="sync"
			/>
		</main>
	);
}
