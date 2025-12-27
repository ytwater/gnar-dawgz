import { TORREY_PILES_LAT_LNG } from "~/app/config/constants";
import { getPointForecastV1PointGet } from "~/app/lib/swellcloud/swellcloud-api";

export async function fetchSwellcloudForecast({
	lat,
	lon,
	apiKey,
}: { lat: number; lon: number; apiKey: string }) {
	if (!apiKey) {
		throw new Error("Swellcloud API key is required");
	}

	// Calculate date range: now to 7 days in the future
	const now = new Date();
	const endDate = new Date(now);
	endDate.setDate(endDate.getDate() + 7);

	const res = await getPointForecastV1PointGet(
		{
			lat,
			lon,
			model: "gfs", // default model
			vars: "hs,tp,dp", // wave height, period, direction
			units: "uk", // UK units (feet for height)
			start: now.toISOString(),
			end: endDate.toISOString(),
		},
		{
			headers: {
				"X-API-Key": apiKey,
			},
		},
	);

	if (res.status !== 200) {
		console.error("Swellcloud API error:", res.status, res.data);
		throw new Error(`Swellcloud API error: ${res.status}`);
	}

	// Swellcloud API returns an object with a data property containing the array:
	// {
	//   "data": [
	//     {
	//       "time": "2025-12-27T21:00:00Z",
	//       "hs": 3.35,
	//       "tp": 12,
	//       "dp": 271.52
	//     },
	//     ...
	//   ],
	//   "model": "gfs",
	//   "model_info": {...}
	// }
	const response = res.data as
		| {
				data: {
					time: string; // ISO string
					hs: number; // wave height
					tp: number; // wave period
					dp: number; // wave direction
				}[];
				model?: string;
				model_info?: unknown;
		  }
		| unknown;

	// Extract the data array
	const data =
		response &&
		typeof response === "object" &&
		"data" in response &&
		Array.isArray(response.data)
			? response.data
			: null;

	if (!data) {
		console.warn(
			"Swellcloud API returned unexpected data structure. Response:",
			JSON.stringify(res.data, null, 2),
		);
		return { waves: [] };
	}

	console.log(`Swellcloud API returned ${data.length} data points`);

	if (data.length === 0) {
		console.warn("Swellcloud API returned no points data.");
		return { waves: [] };
	}

	const waveData = data.map(
		(p: {
			time: string; // ISO string
			hs: number; // wave height
			tp: number; // wave period
			dp: number; // wave direction
		}) => {
			// Parse ISO string timestamp
			const timestamp = new Date(p.time);
			if (isNaN(timestamp.getTime())) {
				console.warn(`Invalid timestamp: ${p.time}`);
				return null;
			}

			return {
				timestamp,
				waveHeightMin: p.hs,
				waveHeightMax: p.hs,
				wavePeriod: p.tp,
				waveDirection: p.dp,
				swells: JSON.stringify([]), // Swellcloud doesn't provide individual swell components with basic vars
			};
		},
	).filter((w): w is NonNullable<typeof w> => w !== null);

	return {
		waves: waveData,
	};
}
