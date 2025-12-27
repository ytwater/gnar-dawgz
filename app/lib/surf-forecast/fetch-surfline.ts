import { fetchForecast } from "surfline";
import { SURFLINE_TORREY_PINES_SPOT_ID } from "~/app/config/constants";

export async function fetchSurflineForecast(spotId: string) {
	const [waveRes, ratingRes, tidesRes] = await Promise.all([
		fetchForecast({ spotId, type: "wave", days: 7 }),
		fetchForecast({ spotId, type: "rating", days: 7 }),
		fetchForecast({ spotId, type: "tides", days: 7 }),
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

	// Tide data
	const tideData = tidesRes.data.tides.map(
		(t: { timestamp: number; type: string; height: number }) => ({
			timestamp: new Date(t.timestamp * 1000),
			type: t.type, // HIGH, LOW
			height: t.height,
		}),
	);

	return {
		waves: waveData.map((w) => ({
			...w,
			rating: ratingMap.get(Math.floor(w.timestamp.getTime() / 1000)),
		})),
		tides: tideData,
	};
}
