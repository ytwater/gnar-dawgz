import { and, asc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import {
	surfForecasts,
	surfSpots,
	tideForecasts,
	weatherForecasts,
} from "~/app/lib/surf-forecast-schema";
import {
	getCachedReport,
	storeCachedReport,
	cleanExpiredReports,
} from "~/app/lib/surf-report/cache-manager";
import {
	generateSurfReport,
	type ReportInput,
} from "~/app/lib/surf-report/generate-report";
import { publicProcedure, adminProcedure } from "../server";

export const surfReportRouter = {
	getSurfReport: publicProcedure
		.input(
			z.object({
				spotId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db } = context;
			const { spotId } = input;

			// Check cache first
            try {
                const cached = await getCachedReport(db, spotId);
                if (cached) {
                    return {
                        report: cached.report,
                        generatedAt: cached.generatedAt,
                        expiresAt: cached.expiresAt,
                        fromCache: true,
                    };
                }
            } catch (e) {
                console.error("Error checking surf report cache:", e);
                const message = e instanceof Error ? e.message : "Unknown cache error";
				throw new Error(`Failed to access surf report cache: ${message}`);
            }

			// Generate on-demand
			try {
				const result = await generateAndCacheReport(db, spotId);
				return {
					report: result.report,
					generatedAt: result.generatedAt,
					expiresAt: result.expiresAt,
					fromCache: false,
				};
			} catch (e) {
				console.error("Error generating surf report:", e);
				const message = e instanceof Error ? e.message : "Unknown error";
				throw new Error(`Failed to generate surf report: ${message}`);
			}
		}),

	generateSurfReport: adminProcedure
		.input(
			z.object({
				spotId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { db } = context;
			const { spotId } = input;

			try {
				const result = await generateAndCacheReport(db, spotId);

				// Also clean up expired reports
				await cleanExpiredReports(db).catch((e) =>
					console.error("Error cleaning expired reports:", e),
				);

				return {
					report: result.report,
					generatedAt: result.generatedAt,
					expiresAt: result.expiresAt,
					fromCache: false,
				};
			} catch (e) {
				console.error("Error force-generating surf report:", e);
				const message = e instanceof Error ? e.message : "Unknown error";
				throw new Error(`Failed to generate surf report: ${message}`);
			}
		}),
};

async function generateAndCacheReport(
	db: ReturnType<typeof import("~/app/lib/db").getDb>,
	spotId: string,
) {
	const now = new Date();

	// Get spot info
	const spot = await db
		.select()
		.from(surfSpots)
		.where(eq(surfSpots.id, spotId))
		.get();

	if (!spot) {
		throw new Error(`Spot not found: ${spotId}`);
	}

	// Fetch all available future forecast data

	const [waves, tides, weather] = await Promise.all([
		db
			.select()
			.from(surfForecasts)
			.where(
				and(
					eq(surfForecasts.spotId, spotId),
					gte(surfForecasts.timestamp, now),
				),
			)
			.orderBy(asc(surfForecasts.timestamp))
			.limit(100),
		db
			.select()
			.from(tideForecasts)
			.where(
				and(
					eq(tideForecasts.spotId, spotId),
					gte(tideForecasts.timestamp, now),
				),
			)
			.orderBy(asc(tideForecasts.timestamp))
			.limit(50),
		db
			.select()
			.from(weatherForecasts)
			.where(
				and(
					eq(weatherForecasts.spotId, spotId),
					gte(weatherForecasts.timestamp, now),
				),
			)
			.orderBy(asc(weatherForecasts.timestamp))
			.limit(50),
	]);

	// Prefer surfline data if available, fall back to swellcloud
	const surflineWaves = waves.filter((w) => w.source === "surfline");
	const forecastWaves = surflineWaves.length > 0 ? surflineWaves : waves;

	const reportInput: ReportInput = {
		spotName: spot.name,
		forecasts: forecastWaves.map((w) => ({
			waveHeightMin: w.waveHeightMin,
			waveHeightMax: w.waveHeightMax,
			wavePeriod: w.wavePeriod,
			waveDirection: w.waveDirection,
			windSpeed: w.windSpeed,
			windDirection: w.windDirection,
			rating: w.rating,
			timestamp: w.timestamp,
		})),
		tides: tides.map((t) => ({
			type: t.type,
			height: t.height,
			timestamp: t.timestamp,
		})),
		weather: weather.map((w) => ({
			temperature: w.temperature,
			windSpeed: w.windSpeed,
			windDirection: w.windDirection,
			cloudCover: w.cloudCover,
			precipitation: w.precipitation,
			timestamp: w.timestamp,
		})),
	};

	const report = generateSurfReport(reportInput);
	const cached = await storeCachedReport(db, spotId, report);

	return cached;
}