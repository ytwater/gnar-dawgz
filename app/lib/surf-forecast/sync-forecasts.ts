import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "~/app/lib/db";
import {
	surfForecasts,
	surfSpots,
	tideForecasts,
	weatherForecasts,
} from "~/app/lib/surf-forecast-schema";
import { fetchSurflineForecast } from "./fetch-surfline";
import { fetchSwellcloudForecast } from "./fetch-swellcloud";
import { fetchOpenMeteoWeather } from "./fetch-weather";

export type SurfForecastInsert = typeof surfForecasts.$inferInsert;
export type TideForecastInsert = typeof tideForecasts.$inferInsert;

export async function syncSurfForecasts(
	env: CloudflareBindings,
	spotId?: string,
) {
	console.log("syncSurfForecasts spotId", spotId);
	const db = getDb(env.DB);
	const now = new Date();

	// 0. Ensure we have at least Torrey Pines
	// For cron updates (no spotId), only sync the spot with oldest/blank lastSyncedAt
	const baseQuery = db
		.select()
		.from(surfSpots)
		.where(spotId ? eq(surfSpots.id, spotId) : eq(surfSpots.isActive, true));

	const spots = spotId
		? await baseQuery
		: await baseQuery.orderBy(asc(surfSpots.lastSyncedAt)).limit(1);
	console.log("🚀 ~ sync-forecasts.ts:34 ~ syncSurfForecasts ~ spots:", spots);

	const ENABLE_SURFLINE = (env.ENABLE_SURFLINE as string) !== "false";
	const ENABLE_SWELL_CLOUD = (env.ENABLE_SWELL_CLOUD as string) !== "false";
	console.log("ENABLE_SURFLINE", ENABLE_SURFLINE);
	console.log("ENABLE_SWELL_CLOUD", ENABLE_SWELL_CLOUD);
	for (const spot of spots) {
		const currentSpotId = spot.id;
		let syncSuccess = false;

		// 1. Fetch from Surfline
		if (ENABLE_SURFLINE && spot.surflineId) {
			try {
				console.log("Fetching Surfline forecast for", spot.name);
				const surflineData = await fetchSurflineForecast(spot.surflineId);

				// Wave forecasts
				const surflineWaves: SurfForecastInsert[] = surflineData.waves
					.filter((w: { timestamp: Date }) => w.timestamp >= now)
					.map(
						(w: {
							timestamp: Date;
							waveHeightMin: number;
							waveHeightMax: number;
							wavePeriod: number;
							waveDirection: number;
							rating?: string;
							swells: string;
							windSpeed?: number;
							windDirection?: number;
							temperature?: number;
						}) => ({
							id: `surfline_${currentSpotId}_${w.timestamp.getTime()}`,
							source: "surfline",
							spotId: currentSpotId,
							timestamp: w.timestamp,
							waveHeightMin: w.waveHeightMin,
							waveHeightMax: w.waveHeightMax,
							wavePeriod: w.wavePeriod,
							waveDirection: w.waveDirection,
							windSpeed: w.windSpeed,
							windDirection: w.windDirection,
							temperature: w.temperature,
							rating: w.rating,
							swells: w.swells,
						}),
					);

				if (surflineWaves.length > 0) {
					for (const chunk of chunkArray(surflineWaves, 5)) {
						await db
							.insert(surfForecasts)
							.values(chunk)
							.onConflictDoUpdate({
								target: [
									surfForecasts.source,
									surfForecasts.spotId,
									surfForecasts.timestamp,
								],
								set: {
									waveHeightMin: sql`excluded.wave_height_min`,
									waveHeightMax: sql`excluded.wave_height_max`,
									wavePeriod: sql`excluded.wave_period`,
									waveDirection: sql`excluded.wave_direction`,
									windSpeed: sql`excluded.wind_speed`,
									windDirection: sql`excluded.wind_direction`,
									temperature: sql`excluded.temperature`,
									rating: sql`excluded.rating`,
									swells: sql`excluded.swells`,
									fetchedAt: new Date(),
								},
							});
					}
				}

				// Tide forecasts
				const surflineTides: TideForecastInsert[] = surflineData.tides
					.filter((t: { timestamp: Date }) => t.timestamp >= now)
					.map(
						(t: {
							timestamp: Date;
							type: string;
							height: number;
						}) => ({
							id: `surfline_${currentSpotId}_${t.timestamp.getTime()}`,
							source: "surfline",
							spotId: currentSpotId,
							timestamp: t.timestamp,
							type: t.type,
							height: t.height,
						}),
					);

				if (surflineTides.length > 0) {
					for (const chunk of chunkArray(surflineTides, 5)) {
						await db
							.insert(tideForecasts)
							.values(chunk)
							.onConflictDoUpdate({
								target: [
									tideForecasts.source,
									tideForecasts.spotId,
									tideForecasts.timestamp,
								],
								set: {
									type: sql`excluded.type`,
									height: sql`excluded.height`,
									fetchedAt: new Date(),
								},
							});
					}
				}
				syncSuccess = true;
			} catch (error) {
				console.error(
					`Error syncing Surfline forecast for ${spot.name}:`,
					error,
				);
			}
		}

		// 2. Fetch from Swellcloud
		if (ENABLE_SWELL_CLOUD) {
			try {
				const swellCloudApiKey = env.SWELL_CLOUD_API_KEY;
				if (!swellCloudApiKey) {
					console.error(`SWELL_CLOUD_API_KEY is not set for spot ${spot.name}`);
					throw new Error("SWELL_CLOUD_API_KEY is not set");
				}

				console.log(
					`Fetching Swellcloud forecast for ${spot.name} at ${spot.lat}, ${spot.lng}`,
				);
				const swellcloudData = await fetchSwellcloudForecast({
					lat: spot.lat,
					lon: spot.lng,
					apiKey: swellCloudApiKey,
				});

				console.log(
					`Swellcloud returned ${swellcloudData.waves.length} wave data points for ${spot.name}`,
				);

				const swellcloudWaves: SurfForecastInsert[] = swellcloudData.waves
					.filter((w: { timestamp: Date }) => w.timestamp >= now)
					.map(
						(w: {
							timestamp: Date;
							waveHeightMin: number;
							waveHeightMax: number;
							wavePeriod: number;
							waveDirection: number;
							swells: string;
							windSpeed?: number;
							windDirection?: number;
							temperature?: number;
						}) => ({
							id: `swellcloud_${currentSpotId}_${w.timestamp.getTime()}`,
							source: "swellcloud",
							spotId: currentSpotId,
							timestamp: w.timestamp,
							waveHeightMin: w.waveHeightMin,
							waveHeightMax: w.waveHeightMax,
							wavePeriod: w.wavePeriod,
							waveDirection: w.waveDirection,
							windSpeed: w.windSpeed,
							windDirection: w.windDirection,
							temperature: w.temperature,
							swells: w.swells,
						}),
					);

				console.log(
					`Filtered to ${swellcloudWaves.length} future wave forecasts for ${spot.name}`,
				);

				if (swellcloudWaves.length > 0) {
					for (const chunk of chunkArray(swellcloudWaves, 5)) {
						await db
							.insert(surfForecasts)
							.values(chunk)
							.onConflictDoUpdate({
								target: [
									surfForecasts.source,
									surfForecasts.spotId,
									surfForecasts.timestamp,
								],
								set: {
									waveHeightMin: sql`excluded.wave_height_min`,
									waveHeightMax: sql`excluded.wave_height_max`,
									wavePeriod: sql`excluded.wave_period`,
									waveDirection: sql`excluded.wave_direction`,
									windSpeed: sql`excluded.wind_speed`,
									windDirection: sql`excluded.wind_direction`,
									temperature: sql`excluded.temperature`,
									swells: sql`excluded.swells`,
									fetchedAt: new Date(),
								},
							});
					}
					console.log(
						`Successfully inserted ${swellcloudWaves.length} Swellcloud forecasts for ${spot.name}`,
					);
				} else {
					console.warn(
						`No Swellcloud wave forecasts to insert for ${spot.name} (all in past or empty)`,
					);
				}
				syncSuccess = true;
			} catch (error) {
				console.error(
					`Error syncing Swellcloud forecast for ${spot.name}:`,
					error,
				);
				if (error instanceof Error) {
					console.error(`Error details: ${error.message}`, error.stack);
				}
			}
		}

		// 3. Fetch from OpenMeteo (Weather)
		try {
			console.log(
				`Fetching OpenMeteo weather for ${spot.name} at ${spot.lat}, ${spot.lng}`,
			);
			const weatherData = await fetchOpenMeteoWeather(spot.lat, spot.lng);

			const weatherInserts = weatherData.map((w) => ({
				...w,
				id: `weather_${currentSpotId}_${w.timestamp.getTime()}`,
				spotId: currentSpotId,
			}));

			if (weatherInserts.length > 0) {
				for (const chunk of chunkArray(weatherInserts, 10)) {
					await db
						.insert(weatherForecasts)
						.values(chunk)
						.onConflictDoUpdate({
							target: [weatherForecasts.spotId, weatherForecasts.timestamp],
							set: {
								temperature: sql`excluded.temperature`,
								precipitation: sql`excluded.precipitation`,
								cloudCover: sql`excluded.cloud_cover`,
								windSpeed: sql`excluded.wind_speed`,
								windDirection: sql`excluded.wind_direction`,
								weatherCode: sql`excluded.weather_code`,
								fetchedAt: new Date(),
							},
						});
				}
				console.log(
					`Successfully synced ${weatherInserts.length} weather forecasts for ${spot.name}`,
				);
			}
			syncSuccess = true;
		} catch (error) {
			console.error(`Error syncing weather forecast for ${spot.name}:`, error);
		}

		// Update lastSyncedAt if sync was successful
		if (syncSuccess) {
			await db
				.update(surfSpots)
				.set({ lastSyncedAt: new Date() })
				.where(eq(surfSpots.id, currentSpotId));
		}
	}
}

function chunkArray<T>(array: T[], size: number): T[][] {
	const chunks = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}
