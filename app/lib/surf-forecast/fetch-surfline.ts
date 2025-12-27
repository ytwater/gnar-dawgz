import { fetchForecast } from "surfline";
import { SURFLINE_TORREY_PINES_SPOT_ID } from "~/app/config/constants";

export async function fetchSurflineForecast(spotId: string) {
	const [waveRes, ratingRes, tidesRes, windRes, weatherRes] = await Promise.all([
		fetchForecast({ spotId, type: "wave", days: 7 }),
		fetchForecast({ spotId, type: "rating", days: 7 }),
		fetchForecast({ spotId, type: "tides", days: 7 }),
		fetchForecast({ spotId, type: "wind", days: 7 }),
		fetchForecast({ spotId, type: "weather", days: 7 }),
	]);

	// Normalize data
	// Wave data
	const waveData = waveRes.data.wave.map(
		(p: {
			timestamp: number;
			surf: { min: number; max: number };
			swells?: { period: number; direction: number; height: number }[];
		}) => ({
			timestamp: new Date(p.timestamp * 1000),
			waveHeightMin: p.surf.min,
			waveHeightMax: p.surf.max,
			wavePeriod: p.swells?.[0]?.period || 0,
			waveDirection: p.swells?.[0]?.direction || 0,
			swells: JSON.stringify(p.swells || []),
		}),
	);

	// Rating data
	const ratingMap = new Map<number, string>();
	const ratings = ratingRes.data.rating || [];
	for (const r of ratings) {
		ratingMap.set(r.timestamp, r.rating.key);
	}

	// Wind data
	const windMap = new Map<number, { speed: number; direction: number }>();
	const winds = windRes.data.wind || [];
	for (const w of winds) {
		windMap.set(w.timestamp, {
			speed: w.speed,
			direction: w.direction,
		});
	}

	// Weather data (temperature)
	const temperatureMap = new Map<number, number>();
	const weathers = weatherRes.data.weather || [];
	for (const w of weathers) {
		temperatureMap.set(w.timestamp, w.temperature);
	}

	// Tide data
	const tideData = tidesRes.data.tides.map(
		(t: { timestamp: number; type: string; height: number }) => ({
			timestamp: new Date(t.timestamp * 1000),
			type: t.type, // HIGH, LOW
			height: t.height,
		}),
	);

	return {
		waves: waveData.map((w) => {
			const timestamp = Math.floor(w.timestamp.getTime() / 1000);
			const wind = windMap.get(timestamp);
			const temperature = temperatureMap.get(timestamp);
			return {
				...w,
				rating: ratingMap.get(timestamp),
				windSpeed: wind?.speed,
				windDirection: wind?.direction,
				temperature,
			};
		}),
		tides: tideData,
	};
}
