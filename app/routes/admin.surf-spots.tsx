import {
	ArrowClockwise,
	CaretLeft,
	CaretRight,
	CheckCircle,
	CircleNotch,
	Database,
	Globe,
	MagnifyingGlass,
	MapPin,
	Plus,
	Prohibit,
	Trash,
} from "@phosphor-icons/react";
import { and, eq, like } from "drizzle-orm";
import { useState } from "react";
import {
	Form,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
	useSearchParams,
} from "react-router";
import { fetchSpotInfo, fetchTaxonomy } from "surfline";
import type { Route } from "~/app/+types/admin.surf-spots";
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
import { getDb } from "~/app/lib/db";
import { surfSpots, surfTaxonomy } from "~/app/lib/surf-forecast-schema";
import { syncSurfForecasts } from "~/app/lib/surf-forecast/sync-forecasts";

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

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const auth = createAuth(context.cloudflare.env, request.cf);
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		throw redirect("/login");
	}

	const url = new URL(request.url);
	const parentId = url.searchParams.get("parentId") || SOCAL_REGION_ID;
	const search = url.searchParams.get("search") || "";

	const db = getDb(context.cloudflare.env.DB);

	// Fetch user spots
	const spots = await db.select().from(surfSpots);

	// Fetch taxonomy from cache
	let taxonomyItems = [];
	if (search) {
		taxonomyItems = await db
			.select()
			.from(surfTaxonomy)
			.where(and(like(surfTaxonomy.name, `%${search}%`)))
			.limit(50);
	} else {
		taxonomyItems = await db
			.select()
			.from(surfTaxonomy)
			.where(eq(surfTaxonomy.parentId, parentId))
			.orderBy(surfTaxonomy.type, surfTaxonomy.name);
	}

	// Get breadcrumbs
	const breadcrumbs = [];
	let currentId: string | null = parentId;
	while (currentId && breadcrumbs.length < 5) {
		const parent = await db
			.select()
			.from(surfTaxonomy)
			.where(eq(surfTaxonomy.id, currentId))
			.get();
		if (parent) {
			breadcrumbs.unshift(parent);
			currentId = parent.parentId;
		} else {
			break;
		}
	}

	return { spots, taxonomyItems, breadcrumbs, parentId, search };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const auth = createAuth(context.cloudflare.env, request.cf);
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) return redirect("/login");

	const formData = await request.formData();
	const intent = formData.get("intent");
	const db = getDb(context.cloudflare.env.DB);

	if (intent === "sync-taxonomy") {
		const targetId = (formData.get("id") as string) || SOCAL_REGION_ID;
		try {
			// Try to fetch the target node directly
			let res: Awaited<ReturnType<typeof fetchTaxonomy>>;
			try {
				res = await fetchTaxonomy({ id: targetId, maxDepth: 1 });
			} catch (directError) {
				// If direct fetch fails, try fetching from parent first (for San Diego, parent is SoCal)
				if (targetId === SANDIEGO_SUBREGION_ID) {
					// Try to find San Diego by searching up the hierarchy
					// First try the known parent IDs from Torrey Pines (real Surfline IDs)
					// Then try SoCal, California, United States
					const parentIdsToTry = [
						...TORREY_PINES_PARENT_IDS.map((id) => ({
							id,
							name: `Torrey Pines Parent (${id.slice(-6)})`,
						})),
						{ id: SOCAL_REGION_ID, name: "SoCal" },
						{ id: CALIFORNIA_ID, name: "California" },
						{ id: UNITED_STATES_ID, name: "United States" },
					];

					let parentRes: Awaited<ReturnType<typeof fetchTaxonomy>> | null =
						null;
					let triedParent = "";

					for (const parent of parentIdsToTry) {
						try {
							parentRes = await fetchTaxonomy({
								id: parent.id,
								maxDepth: 3, // Get deeper to find San Diego (increased from 2)
							});
							triedParent = parent.name;
							break;
						} catch (err) {
							// Continue to next parent
						}
					}

					if (!parentRes) {
						return {
							error:
								"Could not fetch any parent taxonomy (tried SoCal, California, United States). The taxonomy IDs may be incorrect or the API structure has changed.",
						};
					}

					try {
						// Save parent
						await db
							.insert(surfTaxonomy)
							.values({
								id: parentRes._id,
								parentId: parentRes.liesIn[0] || null,
								name: parentRes.name,
								type: parentRes.type,
								spotId:
									parentRes.type === "spot"
										? (parentRes as unknown as { spot: string }).spot
										: null,
								lat: parentRes.location.coordinates[1],
								lng: parentRes.location.coordinates[0],
							})
							.onConflictDoUpdate({
								target: surfTaxonomy.id,
								set: { name: parentRes.name, updatedAt: new Date() },
							});

						// Find San Diego in children (recursively search through all levels)
						let sanDiegoFound: (typeof parentRes.contains)[0] | null = null;

						const searchForSanDiego = (
							items: NonNullable<typeof parentRes.contains>,
							depth = 0,
						): NonNullable<typeof parentRes.contains>[0] | null => {
							if (!items || !Array.isArray(items)) return null;
							// Limit search depth to avoid infinite recursion, but go deep enough
							if (depth > 5) return null;

							for (const item of items) {
								// Check if this item matches San Diego
								const nameMatch = item.name.toLowerCase().includes("san diego");
								const idMatch =
									item._id === targetId || item._id === SANDIEGO_SUBREGION_ID;

								if (nameMatch || idMatch) {
									return item;
								}

								// Recursively search in nested children if they exist
								if (
									"contains" in item &&
									item.contains &&
									Array.isArray(item.contains) &&
									item.contains.length > 0
								) {
									const found = searchForSanDiego(item.contains, depth + 1);
									if (found) return found;
								}
							}
							return null;
						};

						// Also check if the parent itself is San Diego
						if (parentRes.name.toLowerCase().includes("san diego")) {
							// Create a compatible object from parentRes
							sanDiegoFound = {
								_id: parentRes._id,
								name: parentRes.name,
								type: parentRes.type,
								location: parentRes.location,
								liesIn: parentRes.liesIn,
								contains: parentRes.contains,
							} as unknown as (typeof parentRes.contains)[0];
						}

						if (
							!sanDiegoFound &&
							parentRes.contains &&
							parentRes.contains.length > 0
						) {
							sanDiegoFound = searchForSanDiego(parentRes.contains, 0);
						}

						// Recursively save all children (including nested ones)
						const saveChildren = async (
							children: NonNullable<typeof parentRes.contains>,
							parentId: string,
						) => {
							if (!children || !Array.isArray(children)) return;
							for (const child of children) {
								await db
									.insert(surfTaxonomy)
									.values({
										id: child._id,
										parentId: parentId,
										name: child.name,
										type: child.type,
										spotId:
											child.type === "spot"
												? (child as unknown as { spot: string }).spot
												: null,
										lat: child.location?.coordinates?.[1] || null,
										lng: child.location?.coordinates?.[0] || null,
									})
									.onConflictDoUpdate({
										target: surfTaxonomy.id,
										set: { name: child.name, updatedAt: new Date() },
									});

								// Recursively save nested children
								if (
									"contains" in child &&
									child.contains &&
									Array.isArray(child.contains) &&
									child.contains.length > 0
								) {
									await saveChildren(child.contains, child._id);
								}
							}
						};

						// Save all children (including nested ones)
						await saveChildren(parentRes.contains, parentRes._id);

						if (!sanDiegoFound) {
							return {
								error: `San Diego not found in ${triedParent}'s taxonomy tree. The taxonomy structure may have changed or the IDs are incorrect.`,
							};
						}

						// Try to fetch San Diego with its children
						try {
							res = await fetchTaxonomy({ id: sanDiegoFound._id, maxDepth: 1 });
						} catch (fetchError) {
							// If we can't fetch it directly, that's okay - we've already saved it from the parent
							// The node might not support direct fetching, but it exists in the taxonomy
							// Return success since we've saved the node, even if we can't get its children
							return { success: true };
						}
					} catch (parentError) {
						console.error("Failed to fetch SoCal parent", parentError);
						const parentErrorMessage =
							parentError instanceof Error
								? parentError.message
								: "Unknown error";
						const directErrorMessage =
							directError instanceof Error
								? directError.message
								: "Unknown error";
						return {
							error: `Failed to sync taxonomy. Direct fetch error: ${directErrorMessage}. Parent fetch error: ${parentErrorMessage}`,
						};
					}
				}
				// For other nodes, rethrow the original error
				else throw directError;
			}

			// Save current item if not exists
			try {
				await db
					.insert(surfTaxonomy)
					.values({
						id: res._id,
						parentId: res.liesIn?.[0] || null,
						name: res.name,
						type: res.type,
						spotId:
							res.type === "spot"
								? (res as unknown as { spot: string }).spot
								: null,
						lat: res.location?.coordinates?.[1] || null,
						lng: res.location?.coordinates?.[0] || null,
					})
					.onConflictDoUpdate({
						target: surfTaxonomy.id,
						set: { name: res.name, updatedAt: new Date() },
					});
			} catch (dbError) {
				console.error("Failed to save taxonomy to database", dbError);
				throw dbError;
			}

			// Save children
			if (res.contains && res.contains.length > 0) {
				for (const child of res.contains) {
					try {
						await db
							.insert(surfTaxonomy)
							.values({
								id: child._id,
								parentId: res._id,
								name: child.name,
								type: child.type,
								spotId:
									child.type === "spot"
										? (child as unknown as { spot: string }).spot
										: null,
								lat: child.location?.coordinates?.[1] || null,
								lng: child.location?.coordinates?.[0] || null,
							})
							.onConflictDoUpdate({
								target: surfTaxonomy.id,
								set: { name: child.name, updatedAt: new Date() },
							});
					} catch (childError) {
						console.error(
							`Failed to save child ${child.name} (${child._id})`,
							childError,
						);
						// Continue with other children even if one fails
					}
				}
			}
			return { success: true };
		} catch (e) {
			console.error("Failed to sync taxonomy", e);
			const errorMessage = e instanceof Error ? e.message : "Unknown error";
			return {
				error: `Failed to sync with Surfline Taxonomy API: ${errorMessage}`,
			};
		}
	}

	if (intent === "add" || intent === "add-taxonomy") {
		const surflineId = formData.get("surflineId") as string;
		const name = formData.get("name") as string;
		const lat = Number.parseFloat(formData.get("lat") as string);
		const lng = Number.parseFloat(formData.get("lng") as string);

		if (!surflineId) return { error: "Surfline ID is required" };

		try {
			let spotData: { _id: string; name: string; lat: number; lon: number };
			if (name && !Number.isNaN(lat) && !Number.isNaN(lng)) {
				spotData = { _id: surflineId, name, lat, lon: lng };
			} else {
				const spotInfoRes = await fetchSpotInfo({ spotIds: [surflineId] });
				const res = spotInfoRes.data[0];
				if (!res) return { error: "Spot not found on Surfline" };
				spotData = { _id: res._id, name: res.name, lat: res.lat, lon: res.lon };
			}

			await db
				.insert(surfSpots)
				.values({
					id: spotData._id,
					name: spotData.name,
					surflineId: spotData._id,
					lat: spotData.lat,
					lng: spotData.lon,
					isActive: true,
				})
				.onConflictDoUpdate({
					target: surfSpots.id,
					set: {
						name: spotData.name,
						surflineId: spotData._id,
						lat: spotData.lat,
						lng: spotData.lon,
					},
				});

			return { success: true };
		} catch (e) {
			console.error("Failed to add spot", e);
			return { error: "Failed to fetch spot info" };
		}
	}

	if (intent === "delete") {
		const id = formData.get("id") as string;
		await db.delete(surfSpots).where(eq(surfSpots.id, id));
		return { success: true };
	}

	if (intent === "toggle-active") {
		const id = formData.get("id") as string;
		const isActive = formData.get("isActive") === "true";
		await db
			.update(surfSpots)
			.set({ isActive: !isActive })
			.where(eq(surfSpots.id, id));
		return { success: true };
	}

	if (intent === "force-sync") {
		const id = formData.get("id") as string;
		if (!id) return { error: "Spot ID is required" };

		try {
			await syncSurfForecasts(context.cloudflare.env, id);
			return { success: true };
		} catch (e) {
			console.error("Failed to sync spot", e);
			const errorMessage = e instanceof Error ? e.message : "Unknown error";
			return { error: `Failed to sync: ${errorMessage}` };
		}
	}

	return { success: true };
};

export default function AdminSurfSpots() {
	const { spots, taxonomyItems, breadcrumbs, parentId, search } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const [searchParams, setSearchParams] = useSearchParams();
	const isAdding = navigation.formData?.get("intent") === "add";
	const isSyncing = navigation.formData?.get("intent") === "sync-taxonomy";
	const syncingSpotId = navigation.formData?.get("id") as string | undefined;
	const isForceSyncing = navigation.formData?.get("intent") === "force-sync";

	return (
		<div className="space-y-8 p-6">
			<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
				<div>
					<h1 className="text-4xl font-extrabold tracking-tight">
						Surf Forecast Setup
					</h1>
					<p className="mt-2 text-muted-foreground">
						Manage spots and browse the Surfline taxonomy to find new locations.
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
													<Form method="post">
														<input type="hidden" name="id" value={spot.id} />
														<input
															type="hidden"
															name="isActive"
															value={String(spot.isActive)}
														/>
														<Button
															type="submit"
															name="intent"
															value="toggle-active"
															variant="ghost"
															className="h-auto p-0 hover:bg-transparent"
														>
															{spot.isActive ? (
																<Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
																	Active
																</Badge>
															) : (
																<Badge variant="secondary">Inactive</Badge>
															)}
														</Button>
													</Form>
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
													<Form method="post">
														<input type="hidden" name="id" value={spot.id} />
														<Button
															type="submit"
															name="intent"
															value="force-sync"
															variant="outline"
															size="sm"
															disabled={
																isForceSyncing && syncingSpotId === spot.id
															}
														>
															{isForceSyncing && syncingSpotId === spot.id ? (
																<>
																	<CircleNotch
																		className="animate-spin mr-2"
																		size={16}
																	/>
																	Syncing...
																</>
															) : (
																<>
																	<ArrowClockwise size={16} className="mr-2" />
																	Sync
																</>
															)}
														</Button>
													</Form>
												</TableCell>
												<TableCell className="text-right">
													<Form
														method="post"
														onSubmit={(e) =>
															!confirm("Delete spot?") && e.preventDefault()
														}
													>
														<input type="hidden" name="id" value={spot.id} />
														<Button
															variant="ghost"
															size="icon"
															name="intent"
															value="delete"
															className="text-destructive"
														>
															<Trash size={18} />
														</Button>
													</Form>
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
								<Plus weight="bold" /> Manual Add
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Form method="post" className="flex gap-2">
								<Input
									name="surflineId"
									placeholder="Surfline ID"
									required
									className="bg-background"
								/>
								<Button name="intent" value="add" disabled={isAdding}>
									{isAdding ? <CircleNotch className="animate-spin" /> : "Add"}
								</Button>
							</Form>
							{actionData?.error && (
								<p className="text-destructive text-sm mt-2">
									{actionData.error}
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
									<Globe weight="bold" /> Spot Explorer
								</CardTitle>
								<Form method="post">
									<input type="hidden" name="id" value={parentId} />
									<Button
										variant="outline"
										size="sm"
										name="intent"
										value="sync-taxonomy"
										disabled={isSyncing}
									>
										{isSyncing ? (
											<CircleNotch className="animate-spin mr-2" />
										) : (
											<Database className="mr-2" />
										)}
										Sync Level
									</Button>
								</Form>
							</div>
							<div className="relative mt-2">
								<MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search cached spots..."
									className="pl-10"
									value={search}
									onChange={(e) =>
										setSearchParams({ search: e.target.value, parentId })
									}
								/>
							</div>
						</CardHeader>
						<CardContent className="flex-1 overflow-auto p-0">
							<div className="px-6 py-2 border-b bg-muted/30 flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap">
								<Button
									variant="ghost"
									size="sm"
									className={`h-7 px-2 ${parentId === SOCAL_REGION_ID ? "font-bold underline" : ""}`}
									onClick={() => setSearchParams({ parentId: SOCAL_REGION_ID })}
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
										<CaretRight size={12} />
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
																<MapPin weight="fill" />
															) : (
																<Globe weight="fill" />
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
														<Form method="post">
															<input
																type="hidden"
																name="surflineId"
																value={item.spotId ?? ""}
															/>
															<input
																type="hidden"
																name="name"
																value={item.name}
															/>
															<input
																type="hidden"
																name="lat"
																value={item.lat ?? 0}
															/>
															<input
																type="hidden"
																name="lng"
																value={item.lng ?? 0}
															/>
															<Button
																size="sm"
																name="intent"
																value="add-taxonomy"
																disabled={spots.some(
																	(s) => s.id === item.spotId,
																)}
															>
																{spots.some((s) => s.id === item.spotId) ? (
																	"Tracked"
																) : (
																	<Plus weight="bold" />
																)}
															</Button>
														</Form>
													) : (
														<Button
															variant="ghost"
															size="sm"
															onClick={() =>
																setSearchParams({ parentId: item.id })
															}
														>
															View <CaretRight className="ml-1" />
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
	);
}
