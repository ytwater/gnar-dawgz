interface ForecastData {
	waveHeightMin: number | null;
	waveHeightMax: number | null;
	wavePeriod: number | null;
	waveDirection: number | null;
	windSpeed: number | null;
	windDirection: number | null;
	rating: string | null;
	timestamp: Date;
}

interface TideData {
	type: string | null;
	height: number | null;
	timestamp: Date;
}

interface WeatherData {
	temperature: number | null;
	windSpeed: number | null;
	windDirection: number | null;
	cloudCover: number | null;
	precipitation: number | null;
	timestamp: Date;
}

export interface ReportInput {
	spotName: string;
	forecasts: ForecastData[];
	tides: TideData[];
	weather: WeatherData[];
}

function getDirectionLabel(degrees: number | null | undefined): string {
	if (degrees === null || degrees === undefined) return "variable";
	const directions = [
		"N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
		"S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
	];
	const index = Math.round(degrees / 22.5) % 16;
	return directions[index];
}

function getSwellDirectionLabel(degrees: number | null | undefined): string {
	if (degrees === null || degrees === undefined) return "variable";
	// Swell direction is where waves come FROM
	const directions = [
		"N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
		"S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
	];
	const index = Math.round(degrees / 22.5) % 16;
	return directions[index];
}

function getWindQuality(
	windSpeed: number | null,
	windDirection: number | null,
): { label: string; description: string } {
	if (windSpeed === null || windSpeed === undefined) {
		return { label: "unknown", description: "wind data unavailable" };
	}

	if (windSpeed < 5) {
		return { label: "glassy", description: "conditions are glassy with light winds" };
	}

	if (windSpeed < 10) {
		// Light winds - generally good
		const dir = getDirectionLabel(windDirection);
		return {
			label: "light",
			description: `light ${dir} winds around ${Math.round(windSpeed)} knots`,
		};
	}

	if (windSpeed < 15) {
		const dir = getDirectionLabel(windDirection);
		// Check if offshore (east winds for west-facing beaches in SoCal)
		if (windDirection !== null && (windDirection >= 45 && windDirection <= 135)) {
			return {
				label: "offshore",
				description: `moderate offshore ${dir} winds at ${Math.round(windSpeed)} knots, cleaning things up nicely`,
			};
		}
		return {
			label: "moderate",
			description: `moderate ${dir} winds at ${Math.round(windSpeed)} knots`,
		};
	}

	const dir = getDirectionLabel(windDirection);
	if (windDirection !== null && (windDirection >= 180 && windDirection <= 315)) {
		return {
			label: "onshore",
			description: `strong onshore ${dir} winds at ${Math.round(windSpeed)} knots, choppy and blown out`,
		};
	}

	return {
		label: "strong",
		description: `strong ${dir} winds at ${Math.round(windSpeed)} knots`,
	};
}

function getWaveQuality(heightMin: number | null, heightMax: number | null, period: number | null): string {
	const avgHeight = heightMin !== null && heightMax !== null
		? (heightMin + heightMax) / 2
		: heightMin ?? heightMax ?? 0;

	if (avgHeight < 1) return "flat";
	if (avgHeight < 2) return "small";
	if (avgHeight < 3) return "fun-sized";
	if (avgHeight < 5) return "solid";
	if (avgHeight < 8) return "pumping";
	return "heavy";
}

function getRatingDescription(rating: string | null): string {
	if (!rating) return "";
	switch (rating.toUpperCase()) {
		case "FLAT": return "Flat conditions";
		case "VERY_POOR": return "Very poor conditions";
		case "POOR": return "Poor conditions";
		case "POOR_TO_FAIR": return "Poor to fair conditions";
		case "FAIR": return "Fair conditions";
		case "FAIR_TO_GOOD": return "Fair to good conditions";
		case "GOOD": return "Good conditions";
		case "GOOD_TO_EPIC": return "Good to epic conditions";
		case "EPIC": return "Epic conditions";
		default: return "";
	}
}

function celsiusToFahrenheit(c: number): number {
	return (c * 9) / 5 + 32;
}

function getTimeOfDay(date: Date): string {
	const hours = date.getHours();
	if (hours < 6) return "early morning";
	if (hours < 9) return "dawn patrol";
	if (hours < 12) return "morning";
	if (hours < 15) return "early afternoon";
	if (hours < 18) return "afternoon";
	if (hours < 20) return "evening";
	return "night";
}

function getNextTideEvent(tides: TideData[], after: Date): TideData | null {
	const highLow = tides.filter(
		(t) => (t.type === "HIGH" || t.type === "LOW") && new Date(t.timestamp) > after,
	);
	return highLow.length > 0 ? highLow[0] : null;
}

function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone: "America/Los_Angeles",
	});
}

export function generateSurfReport(input: ReportInput): string {
	const { spotName, forecasts, tides, weather } = input;
	const now = new Date();

	// Find the current/nearest forecast
	const sortedForecasts = [...forecasts].sort(
		(a, b) => Math.abs(new Date(a.timestamp).getTime() - now.getTime()) - Math.abs(new Date(b.timestamp).getTime() - now.getTime()),
	);

	const currentForecast = sortedForecasts[0] || null;

	// Get forecasts for the next 12-24 hours
	const next24h = forecasts.filter((f) => {
		const t = new Date(f.timestamp).getTime();
		return t > now.getTime() && t < now.getTime() + 24 * 60 * 60 * 1000;
	});

	// Get morning forecasts (6am-10am) for tomorrow
	const tomorrowStart = new Date(now);
	tomorrowStart.setDate(tomorrowStart.getDate() + 1);
	tomorrowStart.setHours(6, 0, 0, 0);
	const tomorrowEnd = new Date(tomorrowStart);
	tomorrowEnd.setHours(10, 0, 0, 0);

	const tomorrowMorning = forecasts.filter((f) => {
		const t = new Date(f.timestamp).getTime();
		return t >= tomorrowStart.getTime() && t <= tomorrowEnd.getTime();
	});

	// Current weather
	const sortedWeather = [...weather].sort(
		(a, b) => Math.abs(new Date(a.timestamp).getTime() - now.getTime()) - Math.abs(new Date(b.timestamp).getTime() - now.getTime()),
	);
	const currentWeather = sortedWeather[0] || null;

	// Build report sections
	const sections: string[] = [];

	// === HEADER / CURRENT CONDITIONS ===
	if (currentForecast) {
		const heightMin = currentForecast.waveHeightMin;
		const heightMax = currentForecast.waveHeightMax;
		const period = currentForecast.wavePeriod;
		const quality = getWaveQuality(heightMin, heightMax, period);
		const windInfo = getWindQuality(currentForecast.windSpeed, currentForecast.windDirection);
		const swellDir = getSwellDirectionLabel(currentForecast.waveDirection);
		const ratingDesc = getRatingDescription(currentForecast.rating);

		let heightStr = "flat";
		if (heightMin !== null && heightMax !== null) {
			if (Math.abs(heightMin - heightMax) < 0.3) {
				heightStr = `${Math.round(heightMin)}-${Math.round(heightMax)} feet`;
			} else {
				heightStr = `${heightMin.toFixed(1)} to ${heightMax.toFixed(1)} feet`;
			}
		} else if (heightMax !== null) {
			heightStr = `around ${heightMax.toFixed(1)} feet`;
		}

		const periodStr = period ? `${Math.round(period)} seconds` : "";

		let intro = `**${spotName} Surf Report** — ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Los_Angeles" })}\n\n`;

		intro += `Right now we've got ${quality} surf out there with waves running ${heightStr}`;
		if (periodStr) {
			intro += ` at ${periodStr}`;
		}
		if (swellDir !== "variable") {
			intro += ` out of the ${swellDir}`;
		}
		intro += ". ";

		if (windInfo.label === "glassy") {
			intro += "Surface conditions are glassy — get out there!";
		} else if (windInfo.label === "offshore") {
			intro += `${windInfo.description}.`;
		} else {
			intro += `We've got ${windInfo.description}.`;
		}

		if (ratingDesc) {
			intro += ` ${ratingDesc} overall.`;
		}

		sections.push(intro);
	} else {
		sections.push(
			`**${spotName} Surf Report** — ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Los_Angeles" })}\n\nNo current wave data available at this time.`,
		);
	}

	// === TIDES & WEATHER ===
	const tideLines: string[] = [];

	const nextTide = getNextTideEvent(tides, now);
	if (nextTide && nextTide.height !== null) {
		const tideTime = new Date(nextTide.timestamp);
		const tideType = nextTide.type === "HIGH" ? "high" : "low";
		tideLines.push(
			`Next ${tideType} tide hits at ${formatTime(tideTime)} (${nextTide.height.toFixed(1)} ft)`,
		);

		// Get the tide after that
		const followingTide = getNextTideEvent(tides, tideTime);
		if (followingTide && followingTide.height !== null) {
			const followType = followingTide.type === "HIGH" ? "high" : "low";
			tideLines.push(
				`followed by a ${followType} at ${formatTime(new Date(followingTide.timestamp))} (${followingTide.height.toFixed(1)} ft)`,
			);
		}
	}

	let tideParagraph = "";
	if (tideLines.length > 0) {
		tideParagraph = tideLines.join(", ") + ".";
	}

	if (currentWeather) {
		const tempF = currentWeather.temperature !== null
			? Math.round(celsiusToFahrenheit(currentWeather.temperature))
			: null;

		let weatherStr = "";
		if (tempF !== null) {
			weatherStr += `Air temp is ${tempF}°F`;
		}
		if (currentWeather.cloudCover !== null) {
			if (currentWeather.cloudCover < 20) {
				weatherStr += weatherStr ? " with clear skies" : "Clear skies";
			} else if (currentWeather.cloudCover < 50) {
				weatherStr += weatherStr ? " with partly cloudy skies" : "Partly cloudy";
			} else if (currentWeather.cloudCover < 80) {
				weatherStr += weatherStr ? " and mostly cloudy" : "Mostly cloudy";
			} else {
				weatherStr += weatherStr ? " under overcast skies" : "Overcast skies";
			}
		}
		weatherStr += ".";

		if (tideParagraph) {
			sections.push(`${tideParagraph} ${weatherStr}`);
		} else {
			sections.push(weatherStr);
		}
	} else if (tideParagraph) {
		sections.push(tideParagraph);
	}

	// === OUTLOOK ===
	if (next24h.length > 0) {
		// Find best conditions in next 24h
		const withHeight = next24h.filter(
			(f) => f.waveHeightMax !== null && f.waveHeightMax > 0,
		);

		if (withHeight.length > 0) {
			const maxWave = withHeight.reduce((best, f) =>
				(f.waveHeightMax ?? 0) > (best.waveHeightMax ?? 0) ? f : best,
			);
			const minWind = withHeight.reduce((best, f) =>
				(f.windSpeed ?? 999) < (best.windSpeed ?? 999) ? f : best,
			);

			const bestTime = new Date(minWind.timestamp);
			const timeLabel = getTimeOfDay(bestTime);

			let outlook = "Looking ahead, ";

			// Check if conditions are building or fading
			const firstHalf = next24h.slice(0, Math.floor(next24h.length / 2));
			const secondHalf = next24h.slice(Math.floor(next24h.length / 2));

			const avgFirst = firstHalf.reduce((sum, f) => sum + ((f.waveHeightMax ?? 0) + (f.waveHeightMin ?? 0)) / 2, 0) / (firstHalf.length || 1);
			const avgSecond = secondHalf.reduce((sum, f) => sum + ((f.waveHeightMax ?? 0) + (f.waveHeightMin ?? 0)) / 2, 0) / (secondHalf.length || 1);

			if (avgSecond > avgFirst * 1.2) {
				outlook += "swell is building through the day";
			} else if (avgSecond < avgFirst * 0.8) {
				outlook += "swell is fading as the day goes on";
			} else {
				outlook += "conditions should hold steady";
			}

			if (maxWave.waveHeightMax !== null && maxWave.waveHeightMax > 0) {
				outlook += ` with sets up to ${maxWave.waveHeightMax.toFixed(1)} feet`;
			}

			outlook += `. Best bet looks like ${timeLabel}`;

			if (minWind.windSpeed !== null && minWind.windSpeed < 8) {
				outlook += " when winds are lightest";
			}

			outlook += ".";

			// Tomorrow morning preview
			if (tomorrowMorning.length > 0) {
				const tmAvgHeight = tomorrowMorning.reduce(
					(sum, f) => sum + ((f.waveHeightMax ?? 0) + (f.waveHeightMin ?? 0)) / 2,
					0,
				) / tomorrowMorning.length;
				const tmQuality = getWaveQuality(null, tmAvgHeight, null);

				if (tmAvgHeight > 0) {
					outlook += ` Tomorrow morning is looking ${tmQuality} with waves around ${tmAvgHeight.toFixed(1)} feet.`;
				}
			}

			sections.push(outlook);
		}
	}

	return sections.join("\n\n");
}