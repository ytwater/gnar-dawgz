import { and, asc, eq, gte, like } from "drizzle-orm";
import { fetchSpotInfo, fetchTaxonomy } from "surfline";
import { z } from "zod";
import {
	surfForecasts,
	surfSpots,
	surfTaxonomy,
	tideForecasts,
	weatherForecasts,
} from "~/app/lib/surf-forecast-schema";
import { syncSurfForecasts } from "~/app/lib/surf-forecast/sync-forecasts";
import { adminProcedure, publicProcedure } from "../server";

export const surfForecastRouter = {
	// Get all active spots
	getActiveSpots: publicProcedure.handler(async ({ context }) => {
		const { db } = context;
		const spots = await db
			.select()
			.from(surfSpots)
			.where(eq(surfSpots.isActive, true))
			.orderBy(asc(surfSpots.name));

		return spots;
	}),

	// Get forecasts for a specific spot
	getForecasts: publicProcedure
		.input(
			z.object({
				spotId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db } = context;
			const { spotId } = input;
			const now = new Date();

			const [waves, tides] = await Promise.all([
				db
					.select()
					.from(surfForecasts)
					.where(
						and(
							eq(surfForecasts.spotId, spotId),
							gte(surfForecasts.timestamp, now),
						),
					)
					.orderBy(asc(surfForecasts.timestamp)),
				db
					.select()
					.from(tideForecasts)
					.where(
						and(
							eq(tideForecasts.spotId, spotId),
							gte(tideForecasts.timestamp, now),
						),
					)
					.orderBy(asc(tideForecasts.timestamp)),
			]);

			return { waves, tides };
		}),

	// Get dashboard data for a spot (processed/combined data)
	getDashboardData: publicProcedure
		.input(
			z.object({
				spotId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db } = context;
			const { spotId } = input;
			const now = new Date();

			const allWaves = await db
				.select()
				.from(surfForecasts)
				.where(
					and(
						eq(surfForecasts.spotId, spotId),
						gte(surfForecasts.timestamp, now),
					),
				)
				.orderBy(asc(surfForecasts.timestamp));

			const allTides = await db
				.select()
				.from(tideForecasts)
				.where(
					and(
						eq(tideForecasts.spotId, spotId),
						gte(tideForecasts.timestamp, now),
					),
				)
				.orderBy(asc(tideForecasts.timestamp));

			const allWeather = await db
				.select()
				.from(weatherForecasts)
				.where(
					and(
						eq(weatherForecasts.spotId, spotId),
						gte(weatherForecasts.timestamp, now),
					),
				)
				.orderBy(asc(weatherForecasts.timestamp));

			// Group waves by source
			const surflineWaves = allWaves.filter((w) => w.source === "surfline");
			const swellcloudWaves = allWaves.filter((w) => w.source === "swellcloud");

			// Group forecasts by day for the forecast widget (next 5 days)
			const fiveDaysFromNow = new Date(now);
			fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

			const dailyForecasts: {
				date: string;
				dateObj: Date;
				surfline: {
					heightMin: number | null;
					heightMax: number | null;
					heightAvg: number | null;
					period: number | null;
					rating: string | null;
				};
				swellcloud: {
					heightMin: number | null;
					heightMax: number | null;
					heightAvg: number | null;
					period: number | null;
				};
				weather: {
					temperature: number | null;
					precipitation: number | null;
					cloudCover: number | null;
					weatherCode: number | null;
				};
			}[] = [];

			// Group by day
			const dayGroups = new Map<string, typeof allWaves>();
			for (const wave of allWaves) {
				if (wave.timestamp > fiveDaysFromNow) break;
				const dayKey = wave.timestamp.toISOString().split("T")[0];
				if (!dayGroups.has(dayKey)) {
					dayGroups.set(dayKey, []);
				}
				const dayGroup = dayGroups.get(dayKey);
				if (dayGroup) {
					dayGroup.push(wave);
				}
			}

			// Group weather by day
			const weatherDayGroups = new Map<string, typeof allWeather>();
			for (const weather of allWeather) {
				if (weather.timestamp > fiveDaysFromNow) break;
				const dayKey = weather.timestamp.toISOString().split("T")[0];
				if (!weatherDayGroups.has(dayKey)) {
					weatherDayGroups.set(dayKey, []);
				}
				const weatherDayGroup = weatherDayGroups.get(dayKey);
				if (weatherDayGroup) {
					weatherDayGroup.push(weather);
				}
			}

			// Process each day
			for (const [dayKey, waves] of dayGroups.entries()) {
				const dayDate = new Date(`${dayKey}T00:00:00`);
				const daySurfline = waves.filter((w) => w.source === "surfline");
				const daySwellcloud = waves.filter((w) => w.source === "swellcloud");
				const dayWeather = weatherDayGroups.get(dayKey) || [];

				const surflineHeights = daySurfline
					.map((w) => {
						if (w.waveHeightMin && w.waveHeightMax) {
							return (w.waveHeightMin + w.waveHeightMax) / 2;
						}
						return null;
					})
					.filter((h): h is number => h !== null);

				const swellcloudHeights = daySwellcloud
					.map((w) => w.waveHeightMax)
					.filter((h): h is number => h !== null);

				const surflinePeriods = daySurfline
					.map((w) => w.wavePeriod)
					.filter((p): p is number => p !== null);

				const swellcloudPeriods = daySwellcloud
					.map((w) => w.wavePeriod)
					.filter((p): p is number => p !== null);

				// Calculate weather averages
				const temperatures = dayWeather
					.map((w) => w.temperature)
					.filter((t): t is number => t !== null);
				const precipitations = dayWeather
					.map((w) => w.precipitation)
					.filter((p): p is number => p !== null);
				const cloudCovers = dayWeather
					.map((w) => w.cloudCover)
					.filter((c): c is number => c !== null);
				const weatherCodes = dayWeather
					.map((w) => w.weatherCode)
					.filter((c): c is number => c !== null);

				dailyForecasts.push({
					date: dayKey,
					dateObj: dayDate,
					surfline: {
						heightMin:
							daySurfline.length > 0
								? Math.min(
										...daySurfline
											.map((w) => w.waveHeightMin)
											.filter((h): h is number => h !== null),
									)
								: null,
						heightMax:
							daySurfline.length > 0
								? Math.max(
										...daySurfline
											.map((w) => w.waveHeightMax)
											.filter((h): h is number => h !== null),
									)
								: null,
						heightAvg:
							surflineHeights.length > 0
								? surflineHeights.reduce((a, b) => a + b, 0) /
									surflineHeights.length
								: null,
						period:
							surflinePeriods.length > 0
								? surflinePeriods.reduce((a, b) => a + b, 0) /
									surflinePeriods.length
								: null,
						rating: daySurfline.find((w) => w.rating)?.rating || null,
					},
					swellcloud: {
						heightMin:
							swellcloudHeights.length > 0
								? Math.min(...swellcloudHeights)
								: null,
						heightMax:
							swellcloudHeights.length > 0
								? Math.max(...swellcloudHeights)
								: null,
						heightAvg:
							swellcloudHeights.length > 0
								? swellcloudHeights.reduce((a, b) => a + b, 0) /
									swellcloudHeights.length
								: null,
						period:
							swellcloudPeriods.length > 0
								? swellcloudPeriods.reduce((a, b) => a + b, 0) /
									swellcloudPeriods.length
								: null,
					},
					weather: {
						temperature:
							temperatures.length > 0
								? temperatures.reduce((a, b) => a + b, 0) / temperatures.length
								: null,
						precipitation:
							precipitations.length > 0
								? precipitations.reduce((a, b) => a + b, 0) /
									precipitations.length
								: null,
						cloudCover:
							cloudCovers.length > 0
								? cloudCovers.reduce((a, b) => a + b, 0) / cloudCovers.length
								: null,
						weatherCode:
							weatherCodes.length > 0
								? Math.round(
										weatherCodes.reduce((a, b) => a + b, 0) /
											weatherCodes.length,
									)
								: null,
					},
				});
			}

			// Sort by date and limit to 5 days
			dailyForecasts.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
			const nextFiveDays = dailyForecasts.slice(0, 5);

			// Merge for comparison chart
			const combinedData: {
				timestamp: number;
				dateStr: string;
				surflineHeight: number | null;
				swellcloudHeight: number | null;
				surflinePeriod: number | null;
				swellcloudPeriod: number | null;
				surflineWindSpeed: number | null;
				swellcloudWindSpeed: number | null;
				surflineWindDirection: number | null;
				swellcloudWindDirection: number | null;
				rating: string | null;
			}[] = [];
			const timestamps = Array.from(
				new Set(allWaves.map((w) => w.timestamp.getTime())),
			).sort();

			for (const ts of timestamps) {
				const sWave = surflineWaves.find((w) => w.timestamp.getTime() === ts);
				const swWave = swellcloudWaves.find(
					(w) => w.timestamp.getTime() === ts,
				);
				if (sWave || swWave) {
					combinedData.push({
						timestamp: ts,
						dateStr: new Date(ts).toLocaleString([], {
							weekday: "short",
							hour: "numeric",
						}),
						surflineHeight: sWave
							? ((sWave.waveHeightMax ?? 0) + (sWave.waveHeightMin ?? 0)) / 2
							: null,
						swellcloudHeight: swWave ? swWave.waveHeightMax : null,
						surflinePeriod: sWave ? sWave.wavePeriod : null,
						swellcloudPeriod: swWave ? swWave.wavePeriod : null,
						surflineWindSpeed: sWave ? sWave.windSpeed : null,
						swellcloudWindSpeed: swWave ? swWave.windSpeed : null,
						surflineWindDirection: sWave ? sWave.windDirection : null,
						swellcloudWindDirection: swWave ? swWave.windDirection : null,
						rating: sWave ? sWave.rating : null,
					});
				}
			}

			return {
				combinedData,
				allTides,
				dailyForecasts: nextFiveDays,
			};
		}),

	// Admin: Get all spots
	getSpots: adminProcedure.handler(async ({ context }) => {
		const { db } = context;
		const spots = await db.select().from(surfSpots);
		return spots;
	}),

	// Admin: Get taxonomy items
	getTaxonomy: adminProcedure
		.input(
			z.object({
				parentId: z.string().optional(),
				search: z.string().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db } = context;
			const { parentId, search } = input;

			let taxonomyItems: (typeof surfTaxonomy.$inferSelect)[] = [];
			if (search) {
				taxonomyItems = await db
					.select()
					.from(surfTaxonomy)
					.where(like(surfTaxonomy.name, `%${search}%`))
					.limit(50);
			} else if (parentId) {
				taxonomyItems = await db
					.select()
					.from(surfTaxonomy)
					.where(eq(surfTaxonomy.parentId, parentId))
					.orderBy(surfTaxonomy.type, surfTaxonomy.name);
			}

			return taxonomyItems;
		}),

	// Admin: Get breadcrumbs for taxonomy navigation
	getTaxonomyBreadcrumbs: adminProcedure
		.input(
			z.object({
				parentId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db } = context;
			const { parentId } = input;

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

			return breadcrumbs;
		}),

	// Admin: Sync a spot
	syncSpot: adminProcedure
		.input(
			z.object({
				spotId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { spotId } = input;
			console.log("syncSpot spotId", spotId);
			await syncSurfForecasts(context.env, spotId);
			return { success: true };
		}),

	// Admin: Sync taxonomy from Surfline
	syncTaxonomy: adminProcedure
		.input(
			z.object({
				targetId: z.string().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db, env } = context;
			const SOCAL_REGION_ID = "58581a836630e24c44878fd0";
			const SANDIEGO_SUBREGION_ID = "58f7ed65dadb30820bb39f6a";
			const CALIFORNIA_ID = "58581a836630e24c44878fcf";
			const UNITED_STATES_ID = "58581a836630e24c44878fce";
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

			const targetId = input.targetId || SOCAL_REGION_ID;

			try {
				// Try to fetch the target node directly
				let res: Awaited<ReturnType<typeof fetchTaxonomy>>;
				try {
					res = await fetchTaxonomy({ id: targetId, maxDepth: 1 });
				} catch (directError) {
					// If direct fetch fails, try fetching from parent first (for San Diego, parent is SoCal)
					if (targetId === SANDIEGO_SUBREGION_ID) {
						// Try to find San Diego by searching up the hierarchy
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
									maxDepth: 3,
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
								if (depth > 5) return null;

								for (const item of items) {
									const nameMatch = item.name
										.toLowerCase()
										.includes("san diego");
									const idMatch =
										item._id === targetId || item._id === SANDIEGO_SUBREGION_ID;

									if (nameMatch || idMatch) {
										return item;
									}

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
								res = await fetchTaxonomy({
									id: sanDiegoFound._id,
									maxDepth: 1,
								});
							} catch (fetchError) {
								// If we can't fetch it directly, that's okay - we've already saved it from the parent
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
					} else {
						throw directError;
					}
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
		}),

	// Admin: Add a spot
	addSpot: adminProcedure
		.input(
			z.object({
				surflineId: z.string(),
				name: z.string().optional(),
				lat: z.number().optional(),
				lng: z.number().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db } = context;
			const { surflineId, name, lat, lng } = input;

			if (!surflineId) {
				return { error: "Surfline ID is required" };
			}

			try {
				let spotData: { _id: string; name: string; lat: number; lon: number };
				if (name && lat !== undefined && lng !== undefined) {
					spotData = { _id: surflineId, name, lat, lon: lng };
				} else {
					const spotInfoRes = await fetchSpotInfo({ spotIds: [surflineId] });
					const res = spotInfoRes.data[0];
					if (!res) return { error: "Spot not found on Surfline" };
					spotData = {
						_id: res._id,
						name: res.name,
						lat: res.lat,
						lon: res.lon,
					};
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
		}),

	// Admin: Delete a spot
	deleteSpot: adminProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db } = context;
			const { id } = input;
			await db.delete(surfSpots).where(eq(surfSpots.id, id));
			return { success: true };
		}),

	// Admin: Toggle active status of a spot
	toggleActiveSpot: adminProcedure
		.input(
			z.object({
				id: z.string(),
				isActive: z.boolean(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db } = context;
			const { id, isActive } = input;
			await db
				.update(surfSpots)
				.set({ isActive: !isActive })
				.where(eq(surfSpots.id, id));
			return { success: true };
		}),
};
