import { HydrationBoundary } from "@tanstack/react-query";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { createAuth } from "~/app/lib/auth";
import { authClient } from "~/app/lib/auth-client";
import { Layout } from "../components/layout";
import type { Route } from "./+types/_index";
import { loader as surfDashboardLoader } from "./_app.surf-dashboard";
import { SurfDashboardContent } from "./_app.surf-dashboard";

export function meta(_: Route.MetaArgs) {
	return [
		{ title: "Gnar Dawgs" },
		{ name: "description", content: "Welcome to Gnar Dawgs!" },
	];
}

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	// biome-ignore lint/suspicious/noExplicitAny: Cloudflare request.cf type
	const auth = createAuth(context.cloudflare.env, (request as any).cf);
	const session = await auth.api.getSession({ headers: request.headers });

	if (session?.user) {
		return surfDashboardLoader({ context, request } as Parameters<
			typeof surfDashboardLoader
		>[0]);
	}
	return { isLoggedIn: false };
};

export default function Home() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const loaderData = useLoaderData<typeof loader>();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	if (sessionLoading) {
		return (
			<main className="flex items-center justify-center min-h-screen bg-slate-500">
				<div className="text-white">Loading...</div>
			</main>
		);
	}

	if (session?.user && loaderData && "dehydratedState" in loaderData) {
		const handleSpotChange = (value: string) => {
			const params = new URLSearchParams(searchParams);
			params.set("spotId", value);
			navigate(`?${params.toString()}`);
		};

		return (
			<Layout>
				<main className="min-h-screen bg-background">
					<div className="container mx-auto py-6">
						<div className="flex justify-center mb-8">
							<img
								src="/gnar-dawgs-logo-transparent.webp"
								alt="Gnar Dawgs Logo"
								className="block w-full max-w-[300px] h-auto"
								loading="eager"
								fetchPriority="high"
								decoding="sync"
							/>
						</div>
						<HydrationBoundary state={loaderData.dehydratedState}>
							<SurfDashboardContent
								selectedSpotId={loaderData.selectedSpotId}
								selectedSpot={loaderData.selectedSpot}
								onSpotChange={handleSpotChange}
								initialAllSpots={loaderData.allSpots}
								initialDashboardData={loaderData.dashboardData}
							/>
						</HydrationBoundary>
					</div>
				</main>
			</Layout>
		);
	}

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
