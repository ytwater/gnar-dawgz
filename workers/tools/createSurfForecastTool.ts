/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, tool } from "ai";
import { add, set } from "date-fns";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { SURFLINE_TORREY_PINES_SPOT_ID } from "~/app/config/constants";
import { getDb } from "~/app/lib/db";
import {
	surfForecasts,
	surfSpots,
	weatherForecasts,
} from "~/app/lib/surf-forecast-schema";

export const createSurfForecastTool = (
	env: CloudflareBindings,
	source: "surfline" | "swellcloud" = "swellcloud",
) =>
	tool({
		description:
			"get the surf forecast for a specified location.  It will default to tomorrows forecast if no start or end date is provided.",
		inputSchema: z.object({
			startDate: z.string().default(
				add(
					set(new Date(), {
						hours: 0,
						minutes: 0,
						seconds: 0,
						milliseconds: 0,
					}),
					{ days: 1 },
				).toISOString(),
			),
			endDate: z.string().default(
				add(
					set(new Date(), {
						hours: 0,
						minutes: 0,
						seconds: 0,
						milliseconds: 0,
					}),
					{ days: 2 },
				).toISOString(),
			),
		}),
		execute: async ({ startDate, endDate }) => {
			const db = getDb(env.DB);

			// Find Torrey Pines spot
			const torreyPines = await db
				.select()
				.from(surfSpots)
				.where(
					and(
						eq(surfSpots.isActive, true),
						eq(surfSpots.id, SURFLINE_TORREY_PINES_SPOT_ID),
					),
				)
				.limit(1);

			if (!torreyPines || torreyPines.length === 0) {
				return "Error: Torrey Pines surf spot not found in database";
			}

			const spot = torreyPines[0];
			const startDateObj = new Date(startDate);
			const endDateObj = new Date(endDate);

			const forecasts = await db
				.select()
				.from(surfForecasts)
				.where(
					and(
						eq(surfForecasts.spotId, spot.id),
						eq(surfForecasts.source, source),
						gte(surfForecasts.timestamp, startDateObj),
						lte(surfForecasts.timestamp, endDateObj),
					),
				)
				.orderBy(asc(surfForecasts.timestamp));

			// Query weather forecasts from database
			const weather = await db
				.select()
				.from(weatherForecasts)
				.where(
					and(
						eq(weatherForecasts.spotId, spot.id),
						gte(weatherForecasts.timestamp, startDateObj),
						lte(weatherForecasts.timestamp, endDateObj),
					),
				)
				.orderBy(asc(weatherForecasts.timestamp));

			if (forecasts.length === 0) {
				return "No forecast data available for the specified date range";
			}

			// Format forecasts for the prompt
			const forecastData = forecasts.map((f) => ({
				timestamp: new Date(f.timestamp).toISOString(),
				source: f.source,
				waveHeightMin: f.waveHeightMin,
				waveHeightMax: f.waveHeightMax,
				wavePeriod: f.wavePeriod,
				waveDirection: f.waveDirection,
				windSpeed: f.windSpeed,
				windDirection: f.windDirection,
				temperature: f.temperature,
				rating: f.rating,
				swells: f.swells ? JSON.parse(f.swells) : null,
			}));

			const weatherData = weather.map((w) => ({
				timestamp: new Date(w.timestamp).toISOString(),
				temperature: w.temperature,
				precipitation: w.precipitation,
				cloudCover: w.cloudCover,
				windSpeed: w.windSpeed,
				windDirection: w.windDirection,
				weatherCode: w.weatherCode,
			}));

			const today = set(new Date(), {
				hours: 0,
				minutes: 0,
				seconds: 0,
				milliseconds: 0,
			}).toISOString();

			const FORECAST_PROMPT = `Given the following JSON of surf forecast data for the following start and end dates: ${startDate} to ${endDate} at Torrey Pines beach, today is ${today} (all dates are in UTC - .toISOString() format), can you rate the surf quality for each day?  If the duration is a single day, give us a forecast for morning and afternoon for the local time. Can you write it as a concise WhatsApp message with details for the next couple of days? Just output the text of the message.  Feel free to use WhatsApp formatting.

Variables:
- timestamp - Forecast timestamp (ISO string)
- source - Data source ("surfline" or "swellcloud")
- waveHeightMin - Minimum wave height (feet)
- waveHeightMax - Maximum wave height (feet)
- wavePeriod - Wave period in seconds
- waveDirection - Wave direction in degrees (0-360, where 0 is North)
- windSpeed - Wind speed (units vary by source)
- windDirection - Wind direction in degrees (0-360, where 0 is North)
- temperature - Air temperature (units vary by source)
- rating - Surf quality rating (surfline only: "POOR", "FAIR", "GOOD", "EPIC", etc.)
  - swells - JSON object containing multiple swell components (may be null)

Surf Forecast Data:
 ${JSON.stringify(forecastData)}

Weather Forecast Data:
 ${JSON.stringify(weatherData)}`;
			const baseURL = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.AI_GATEWAY_ID}/deepseek`;
			const deepseek = createDeepSeek({
				apiKey: env.DEEPSEEK_API_KEY ?? "",
				baseURL,
				headers: {
					"cf-aig-authorization": env.CLOUDFLARE_API_TOKEN ?? "",
				},
			});
			const model = deepseek.languageModel("deepseek-chat");

			console.log("generating text for forecast");
			const result = await generateText({
				model,
				prompt: FORECAST_PROMPT,
			});
			// console.log(
			// 	"🚀 ~ getSurfForecast.ts:97 ~ createSurfForecastTool ~ result:",
			// 	result,
			// );
			return result.text ?? "No forecast available";
		},
	});
