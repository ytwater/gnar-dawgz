import { and, asc, eq, gte, like } from "drizzle-orm";
import { z } from "zod";
import {
	surfForecasts,
	surfSpots,
	surfTaxonomy,
	tideForecasts,
} from "~/app/lib/surf-forecast-schema";
import { adminProcedure, authedProcedure, publicProcedure } from "../server";

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

			// Process each day
			for (const [dayKey, waves] of dayGroups.entries()) {
				const dayDate = new Date(`${dayKey}T00:00:00`);
				const daySurfline = waves.filter((w) => w.source === "surfline");
				const daySwellcloud = waves.filter((w) => w.source === "swellcloud");

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
				const swWave = swellcloudWaves.find((w) => w.timestamp.getTime() === ts);
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

			let taxonomyItems = [];
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
			} else {
				taxonomyItems = [];
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
};

