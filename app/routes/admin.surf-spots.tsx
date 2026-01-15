import {
	ArrowClockwiseIcon,
	CaretRightIcon,
	CircleNotchIcon,
	DatabaseIcon,
	GlobeIcon,
	MagnifyingGlassIcon,
	MapPinIcon,
	PlusIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { HydrationBoundary } from "@tanstack/react-query";
import * as React from "react";
import {
	type LoaderFunctionArgs,
	redirect,
	useLoaderData,
	useSearchParams,
} from "react-router";
import { Badge } from "~/app/components/ui/badge";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { Input } from "~/app/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/app/components/ui/table";
import { createAuth } from "~/app/lib/auth";
import {
	getSpots,
	getTaxonomy,
	getTaxonomyBreadcrumbs,
} from "~/app/lib/orpc/call-procedure";
import {
	surfForecastKeys,
	useAddSpot,
	useDeleteSpot,
	useSpots,
	useSyncSpot,
	useSyncTaxonomy,
	useTaxonomy,
	useTaxonomyBreadcrumbs,
	useToggleActiveSpot,
} from "~/app/lib/orpc/hooks/use-surf-forecast";
import {
	createQueryClient,
	dehydrateQueryClient,
} from "~/app/lib/orpc/query-client";
import { createORPCContext } from "~/app/lib/orpc/server-helpers";

// Surfline Taxonomy IDs
// Note: These IDs may need to be updated if Surfline's taxonomy structure changes
const SOCAL_REGION_ID = "58581a836630e24c44878fd0";
const SANDIEGO_SUBREGION_ID = "58f7ed65dadb30820bb39f6a"; // Updated from incorrect ID
// Try to find California or United States as fallback
const CALIFORNIA_ID = "58581a836630e24c44878fcf"; // California (parent of SoCal)
const UNITED_STATES_ID = "58581a836630e24c44878fce"; // United States

// Torrey Pines parent taxonomy IDs (from actual Surfline API)
// These are the real taxonomy IDs - one should be San Diego, one should be SoCal
const TORREY_PINES_PARENT_IDS = [
	"58f7ed51dadb30820bb38782",
	"58f7ed51dadb30820bb38791",
	"58f7ed51dadb30820bb3879c",
	"58f7ed51dadb30820bb387a6",
	"5908c46bdadb30820b23c1f3",
	"58f7ed65dadb30820bb39f6a",
	"58f7ed68dadb30820bb3a1a7",
	"58f7ed68dadb30820bb3a18e",
];

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	const auth = createAuth(context.cloudflare.env, request.cf);
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		throw redirect("/login");
	}

	const url = new URL(request.url);
	const parentId = url.searchParams.get("parentId") || SOCAL_REGION_ID;
	const search = url.searchParams.get("search") || "";

	const orpcContext = await createORPCContext(context.cloudflare.env, request);

	// Fetch data via ORPC
	const [spots, taxonomyItems, breadcrumbs] = await Promise.all([
		getSpots(orpcContext),
		getTaxonomy(
			orpcContext,
			search ? undefined : parentId,
			search || undefined,
		),
		getTaxonomyBreadcrumbs(orpcContext, parentId),
	]);

	// Create query client and pre-populate
	const queryClient = createQueryClient();
	queryClient.setQueryData(surfForecastKeys.spots(), spots);
	queryClient.setQueryData(
		surfForecastKeys.taxonomy(
			search ? undefined : parentId,
			search || undefined,
		),
		taxonomyItems,
	);
	queryClient.setQueryData(
		surfForecastKeys.taxonomyBreadcrumbs(parentId),
		breadcrumbs,
	);

	return {
		dehydratedState: dehydrateQueryClient(queryClient),
		parentId,
		search,
	};
};

export default function AdminSurfSpots() {
	const loaderData = useLoaderData<typeof loader>();
	const { parentId, search } = loaderData;
	const [searchParams, setSearchParams] = useSearchParams();
	const [surflineIdInput, setSurflineIdInput] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);

	// Use tanstack-query hooks
	const { data: spots = [] } = useSpots();
	const { data: taxonomyItems = [] } = useTaxonomy(
		search ? undefined : parentId,
		search || undefined,
	);
	const { data: breadcrumbs = [] } = useTaxonomyBreadcrumbs(parentId);

	// Mutations
	const syncTaxonomyMutation = useSyncTaxonomy();
	const addSpotMutation = useAddSpot();
	const deleteSpotMutation = useDeleteSpot();
	const toggleActiveMutation = useToggleActiveSpot();
	const syncSpotMutation = useSyncSpot();

	return (
		<HydrationBoundary state={loaderData.dehydratedState}>
			<div className="space-y-8 p-6">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
					<div>
						<h1 className="text-4xl font-extrabold tracking-tight">
							Surf Forecast Setup
						</h1>
						<p className="mt-2 text-muted-foreground">
							Manage spots and browse the Surfline taxonomy to find new
							locations.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
					{/* Tracking Module */}
					<div className="space-y-6">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0">
								<div>
									<CardTitle>My Tracked Spots</CardTitle>
									<CardDescription>
										Spots currently being synchronized every 6 hours.
									</CardDescription>
								</div>
								<Badge variant="outline" className="h-6">
									{spots.length} Spots
								</Badge>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Spot Name</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Last Synced</TableHead>
											<TableHead>Sync</TableHead>
											<TableHead className="text-right">Action</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{spots.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={5}
													className="text-center py-8 text-muted-foreground"
												>
													No spots tracked yet.
												</TableCell>
											</TableRow>
										) : (
											spots.map((spot) => (
												<TableRow key={spot.id}>
													<TableCell>
														<div className="font-medium">{spot.name}</div>
														<div className="text-xs text-muted-foreground font-mono">
															{spot.surflineId}
														</div>
													</TableCell>
													<TableCell>
														<Button
															variant="ghost"
															className="h-auto p-0 hover:bg-transparent"
															onClick={() =>
																toggleActiveMutation.mutate({
																	id: spot.id,
																	isActive: spot.isActive,
																})
															}
															disabled={toggleActiveMutation.isPending}
														>
															{spot.isActive ? (
																<Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
																	Active
																</Badge>
															) : (
																<Badge variant="secondary">Inactive</Badge>
															)}
														</Button>
													</TableCell>
													<TableCell>
														{spot.lastSyncedAt ? (
															<div className="text-sm">
																{new Date(spot.lastSyncedAt).toLocaleString()}
															</div>
														) : (
															<span className="text-xs text-muted-foreground">
																Never
															</span>
														)}
													</TableCell>
													<TableCell>
														<Button
															variant="outline"
															size="sm"
															onClick={() => syncSpotMutation.mutate(spot.id)}
															disabled={syncSpotMutation.isPending}
														>
															{syncSpotMutation.isPending ? (
																<>
																	<CircleNotchIcon
																		className="animate-spin mr-2"
																		size={16}
																	/>
																	Syncing...
																</>
															) : (
																<>
																	<ArrowClockwiseIcon
																		size={16}
																		className="mr-2"
																	/>
																	Sync
																</>
															)}
														</Button>
													</TableCell>
													<TableCell className="text-right">
														<Button
															variant="ghost"
															size="icon"
															className="text-destructive"
															onClick={() => {
																if (confirm("Delete spot?")) {
																	deleteSpotMutation.mutate(spot.id);
																}
															}}
															disabled={deleteSpotMutation.isPending}
														>
															<TrashIcon size={18} />
														</Button>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>

						<Card className="border-primary/20 bg-primary/5">
							<CardHeader>
								<CardTitle className="text-lg flex items-center gap-2">
									<PlusIcon weight="bold" /> Manual Add
								</CardTitle>
							</CardHeader>
							<CardContent>
								<form
									className="flex gap-2"
									onSubmit={async (e) => {
										e.preventDefault();
										setError(null);
										try {
											await addSpotMutation.mutateAsync({
												surflineId: surflineIdInput,
											});
											setSurflineIdInput("");
										} catch (err) {
											const errorMessage =
												err instanceof Error
													? err.message
													: "Failed to add spot";
											setError(errorMessage);
										}
									}}
								>
									<Input
										value={surflineIdInput}
										onChange={(e) => setSurflineIdInput(e.target.value)}
										placeholder="Surfline ID"
										required
										className="bg-background"
									/>
									<Button type="submit" disabled={addSpotMutation.isPending}>
										{addSpotMutation.isPending ? (
											<CircleNotchIcon className="animate-spin" />
										) : (
											"Add"
										)}
									</Button>
								</form>
								{(error || addSpotMutation.error) && (
									<p className="text-destructive text-sm mt-2">
										{error ||
											(addSpotMutation.error instanceof Error
												? addSpotMutation.error.message
												: "Failed to add spot")}
									</p>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Explorer Module */}
					<div className="space-y-6">
						<Card className="min-h-[600px] flex flex-col">
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2">
										<GlobeIcon weight="bold" /> Spot Explorer
									</CardTitle>
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setError(null);
											syncTaxonomyMutation.mutate(parentId, {
												onError: (err) => {
													const errorMessage =
														err instanceof Error
															? err.message
															: "Failed to sync taxonomy";
													setError(errorMessage);
												},
											});
										}}
										disabled={syncTaxonomyMutation.isPending}
									>
										{syncTaxonomyMutation.isPending ? (
											<CircleNotchIcon className="animate-spin mr-2" />
										) : (
											<DatabaseIcon className="mr-2" />
										)}
										Sync Level
									</Button>
								</div>
								<div className="relative mt-2">
									<MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
									<Input
										placeholder="Search cached spots..."
										className="pl-10"
										value={search}
										onChange={(e) =>
											setSearchParams({ search: e.target.value, parentId })
										}
									/>
								</div>
								{(error || syncTaxonomyMutation.error) && (
									<p className="text-destructive text-sm mt-2">
										{error ||
											(syncTaxonomyMutation.error instanceof Error
												? syncTaxonomyMutation.error.message
												: "Failed to sync taxonomy")}
									</p>
								)}
							</CardHeader>
							<CardContent className="flex-1 overflow-auto p-0">
								<div className="px-6 py-2 border-b bg-muted/30 flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap">
									<Button
										variant="ghost"
										size="sm"
										className={`h-7 px-2 ${parentId === SOCAL_REGION_ID ? "font-bold underline" : ""}`}
										onClick={() =>
											setSearchParams({ parentId: SOCAL_REGION_ID })
										}
									>
										SoCal
									</Button>
									<Button
										variant="ghost"
										size="sm"
										className={`h-7 px-2 ${parentId === SANDIEGO_SUBREGION_ID ? "font-bold underline" : ""}`}
										onClick={() =>
											setSearchParams({ parentId: SANDIEGO_SUBREGION_ID })
										}
									>
										San Diego
									</Button>
									{breadcrumbs.map((bc) => (
										<div key={bc.id} className="flex items-center gap-1">
											<CaretRightIcon size={12} />
											<Button
												variant="ghost"
												size="sm"
												className={`h-7 px-2 ${bc.id === parentId ? "font-bold underline" : ""}`}
												onClick={() => setSearchParams({ parentId: bc.id })}
											>
												{bc.name}
											</Button>
										</div>
									))}
								</div>

								<Table>
									<TableBody>
										{taxonomyItems.length === 0 ? (
											<TableRow>
												<TableCell className="text-center py-20 text-muted-foreground">
													<div className="flex flex-col items-center gap-2">
														<p>No items found in cache for this level.</p>
														<p className="text-xs">
															Click "Sync Level" to fetch from Surfline.
														</p>
													</div>
												</TableCell>
											</TableRow>
										) : (
											taxonomyItems.map((item) => (
												<TableRow
													key={item.id}
													className="group hover:bg-muted/50 transition-colors"
												>
													<TableCell className="py-4">
														<div className="flex items-center gap-3">
															<div
																className={`p-2 rounded-md ${item.type === "spot" ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500"}`}
															>
																{item.type === "spot" ? (
																	<MapPinIcon weight="fill" />
																) : (
																	<GlobeIcon weight="fill" />
																)}
															</div>
															<div>
																<div className="font-semibold">{item.name}</div>
																<div className="text-xs text-muted-foreground uppercase tracking-wider">
																	{item.type}
																</div>
															</div>
														</div>
													</TableCell>
													<TableCell className="text-right py-4 pr-6">
														{item.type === "spot" ? (
															<Button
																size="sm"
																onClick={async () => {
																	if (!item.spotId) return;
																	setError(null);
																	try {
																		await addSpotMutation.mutateAsync({
																			surflineId: item.spotId,
																			name: item.name,
																			lat: item.lat ?? undefined,
																			lng: item.lng ?? undefined,
																		});
																	} catch (err) {
																		const errorMessage =
																			err instanceof Error
																				? err.message
																				: "Failed to add spot";
																		setError(errorMessage);
																	}
																}}
																disabled={
																	addSpotMutation.isPending ||
																	spots.some((s) => s.id === item.spotId)
																}
															>
																{spots.some((s) => s.id === item.spotId) ? (
																	"Tracked"
																) : (
																	<PlusIcon weight="bold" />
																)}
															</Button>
														) : (
															<Button
																variant="ghost"
																size="sm"
																onClick={() =>
																	setSearchParams({ parentId: item.id })
																}
															>
																View <CaretRightIcon className="ml-1" />
															</Button>
														)}
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</HydrationBoundary>
	);
}
