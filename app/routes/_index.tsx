import { HydrationBoundary } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { getSession } from "~/app/lib/auth";
import { authClient } from "~/app/lib/auth-client";
import { Layout } from "../components/layout";
import type { Route } from "./+types/_index";
import { loader as surfDashboardLoader } from "./_app.surf-dashboard";
import { SurfDashboardContent } from "./_app.surf-dashboard";

// Set to 0 for production, higher values for testing the animation
const TRANSITION_DELAY = 0;
const ANIM_DURATION = 400;

type OverlayState = "landing" | "transitioning" | "done";

export function meta(_: Route.MetaArgs) {
	return [
		{ title: "Gnar Dawgs" },
		{ name: "description", content: "Welcome to Gnar Dawgs!" },
	];
}

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	const session = await getSession(request, context.cloudflare.env);

	if (session?.user) {
		return surfDashboardLoader({ context, request } as Parameters<
			typeof surfDashboardLoader
		>[0]);
	}
	const enableSurfline =
		(context.cloudflare.env.ENABLE_SURFLINE as string) !== "false";
	const enableSwellCloud =
		(context.cloudflare.env.ENABLE_SWELL_CLOUD as string) !== "false";
	return { isLoggedIn: false, enableSurfline, enableSwellCloud };
};

export default function Home() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const loaderData = useLoaderData<typeof loader>();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [overlayState, setOverlayState] = useState<OverlayState>("landing");

	const isLoggedIn =
		!sessionLoading &&
		!!session?.user &&
		!!loaderData &&
		"dehydratedState" in loaderData;

	useEffect(() => {
		if (sessionLoading) return;

		if (!isLoggedIn) {
			setOverlayState("done");
			return;
		}

		const timers: ReturnType<typeof setTimeout>[] = [];
		const t1 = setTimeout(() => {
			setOverlayState("transitioning");
			const t2 = setTimeout(() => {
				setOverlayState("done");
			}, ANIM_DURATION);
			timers.push(t2);
		}, TRANSITION_DELAY);
		timers.push(t1);
		return () => timers.forEach(clearTimeout);
	}, [sessionLoading, isLoggedIn]);

	const handleSpotChange = (value: string) => {
		const params = new URLSearchParams(searchParams);
		params.set("spotId", value);
		navigate(`?${params.toString()}`);
	};

	const isDashboard = overlayState !== "landing";

	return (
		<>
			{/* Original page content — untouched */}
			{sessionLoading || !session?.user ? (
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
			) : (
				session?.user &&
				loaderData &&
				"dehydratedState" in loaderData && (
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
										enableSurfline={loaderData.enableSurfline}
										enableSwellCloud={loaderData.enableSwellCloud}
									/>
								</HydrationBoundary>
							</div>
						</main>
					</Layout>
				)
			)}

			{/* Animation overlay — covers page, animates, then removes itself */}
			{overlayState !== "done" && (
				<div
					className={[
						"fixed inset-0 z-50 flex flex-col items-center",
						isDashboard
							? "bg-background pt-[104px]"
							: "bg-slate-500 pt-[35vh]",
					].join(" ")}
					style={{
						transition: [
							`background-color ${ANIM_DURATION}ms ease-out`,
							`padding-top ${ANIM_DURATION}ms ease-out`,
						].join(", "),
					}}
				>
					<img
						src="/gnar-dawgs-logo-transparent.webp"
						alt=""
						aria-hidden="true"
						className={[
							"block w-full h-auto",
							isDashboard ? "max-w-[300px]" : "max-w-[700px] px-4",
						].join(" ")}
						style={{
							transition: `max-width ${ANIM_DURATION}ms ease-out, padding ${ANIM_DURATION}ms ease-out`,
						}}
						loading="eager"
						fetchPriority="high"
						decoding="sync"
					/>
				</div>
			)}
		</>
	);
}
