export function Welcome() {
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
