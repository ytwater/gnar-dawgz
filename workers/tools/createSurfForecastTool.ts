/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, tool } from "ai";
import { add, set } from "date-fns";
import { z } from "zod";
import { TORREY_PILES_LAT_LNG } from "~/config/constants";
import { getPointForecastV1PointGet } from "~/lib/swellcloud/swellcloud-api";

export const createSurfForecastTool = (env: CloudflareBindings) =>
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
			const swellCloudApiKey = env.SWELL_CLOUD_API_KEY;
			if (!swellCloudApiKey) {
				return "Error: Swell Cloud API key is not set";
			}
			const response = await getPointForecastV1PointGet(
				{
					lat: TORREY_PILES_LAT_LNG.lat,
					lon: TORREY_PILES_LAT_LNG.lng,
					start: startDate,
					end: endDate,
					model: "gfs",
					vars: "hs,tp,dp,wndspd,wnddir,ss_hs,ss_dp",
					units: "uk",
				},
				{
					headers: {
						"X-API-Key": swellCloudApiKey,
					},
				},
			);

			const today = set(new Date(), {
				hours: 0,
				minutes: 0,
				seconds: 0,
				milliseconds: 0,
			}).toISOString();

			const FORECAST_PROMPT = `Given the following JSON of wind and swell data for the following start and end dates: ${startDate} to ${endDate} at Torrey Pines beach, today is ${today} (all dates are in UTC - .toISOString() format), can you rate the surf quality for each day?  If the duration is a single day, give us a forecast for morning and afternoon for the local time. Can you write it as a concise WhatsApp message with details for the next couple of days? Just output the text of the message.  Feel free to use WhatsApp formatting.
Variables
hs - Wave height (m or ft)
tp - Peak wave period (s)
dp - Wave direction (°)
ss_hs - Secondary swell height (m or ft)
ss_dp - Secondary swell direction (°)
ww_hs - Wind wave height (m or ft)
ww_dp - Wind wave direction (°)
wndspd - Wind speed (m/s or mph)
wnddir - Wind direction (°)

 ${JSON.stringify(response.data)}`;
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
