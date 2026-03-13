import type { TemperatureUnit } from "~/app/utils/temperatureHelpers";
import { ForecastCard } from "./ForecastCard";

interface ForecastDay {
	date: string;
	dayOfWeek: string;
	highTemp: number | null;
	lowTemp: number | null;
	tempUnit?: TemperatureUnit;
	condition: string;
	icon?: string;
}

interface FiveDayForecastProps {
	/**
	 * Array of forecast data for 5 days.
	 * Temperature values should come from WEATHER API (air temperature),
	 * NOT from Surfline (which provides water temperature).
	 */
	forecasts: ForecastDay[];
	/**
	 * The unit that the API returns temperatures in.
	 * If 'C', values will be converted to Fahrenheit for display.
	 * @default 'F'
	 */
	temperatureUnit?: TemperatureUnit;
	className?: string;
	isLoading?: boolean;
}

/**
 * FiveDayForecast component displays a 5-day weather forecast.
 *
 * IMPORTANT: This component displays AIR temperature from the weather API.
 * Do NOT pass Surfline water temperature data to this component.
 *
 * Data Source: Weather API (e.g., OpenWeatherMap, WeatherAPI, etc.)
 * Display Unit: Always Fahrenheit (°F)
 */
export function FiveDayForecast({
	forecasts,
	temperatureUnit = "F",
	className = "",
	isLoading = false,
}: FiveDayForecastProps) {
	if (isLoading) {
		return (
			<div className={`grid grid-cols-5 gap-2 ${className}`}>
				{Array.from({ length: 5 }).map((_, i) => (
					<div
						key={i}
						className="flex flex-col items-center p-4 rounded-lg bg-card animate-pulse"
					>
						<div className="h-4 w-12 bg-muted rounded mb-2" />
						<div className="h-10 w-10 bg-muted rounded-full my-2" />
						<div className="h-6 w-10 bg-muted rounded mb-1" />
						<div className="h-4 w-8 bg-muted rounded" />
					</div>
				))}
			</div>
		);
	}

	if (!forecasts || forecasts.length === 0) {
		return (
			<div className={`text-center text-muted-foreground p-4 ${className}`}>
				No forecast data available
			</div>
		);
	}

	return (
		<div className={`grid grid-cols-5 gap-2 ${className}`}>
			{forecasts.map((forecast, index) => (
				<ForecastCard
					key={forecast.date || index}
					forecast={{
						...forecast,
						tempUnit: temperatureUnit,
					}}
				/>
			))}
		</div>
	);
}
