import type { weatherForecasts } from "../surf-forecast-schema";

export type WeatherForecastInsert = typeof weatherForecasts.$inferInsert;

export async function fetchOpenMeteoWeather(
	lat: number,
	lng: number,
): Promise<WeatherForecastInsert[]> {
	const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=kn&timeformat=unixtime&timezone=GMT`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch weather from OpenMeteo: ${response.statusText}`,
		);
	}

	const data = (await response.json()) as {
		hourly: {
			time: number[];
			temperature_2m: number[];
			precipitation: number[];
			cloud_cover: number[];
			wind_speed_10m: number[];
			wind_direction_10m: number[];
			weather_code: number[];
		};
	};

	const weatherList: WeatherForecastInsert[] = [];
	const hourly = data.hourly;

	for (let i = 0; i < hourly.time.length; i++) {
		const timestamp = new Date(hourly.time[i] * 1000);
		weatherList.push({
			id: `weather_${lat}_${lng}_${timestamp.getTime()}`,
			spotId: "", // Will be filled by the caller
			timestamp,
			temperature: hourly.temperature_2m[i],
			precipitation: hourly.precipitation[i],
			cloudCover: hourly.cloud_cover[i],
			windSpeed: hourly.wind_speed_10m[i],
			windDirection: hourly.wind_direction_10m[i],
			weatherCode: hourly.weather_code[i],
		});
	}

	return weatherList;
}
