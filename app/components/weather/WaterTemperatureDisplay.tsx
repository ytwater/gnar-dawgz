import {
	formatTemperature,
	type TemperatureUnit,
} from "~/utils/temperatureHelpers";

interface WaterTemperatureDisplayProps {
	/**
	 * Water temperature value from Surfline API
	 */
	temperature: number | null | undefined;
	/**
	 * Unit of the temperature value from Surfline
	 * Surfline typically returns temperatures in Fahrenheit
	 */
	unit?: TemperatureUnit;
	/**
	 * Optional label to display
	 */
	label?: string;
	className?: string;
}

/**
 * WaterTemperatureDisplay component specifically for WATER temperature from Surfline.
 * This is SEPARATE from air temperature (use TemperatureDisplay for air temp).
 *
 * Data Source: Surfline API (water temperature)
 * Display Unit: Fahrenheit (°F)
 */
export function WaterTemperatureDisplay({
	temperature,
	unit = "F",
	label = "Water",
	className = "",
}: WaterTemperatureDisplayProps) {
	const formattedTemp = formatTemperature(temperature, unit);

	return (
		<div className={`flex flex-col items-center ${className}`}>
			{label && (
				<span className="text-xs text-muted-foreground uppercase tracking-wide">
					{label}
				</span>
			)}
			<span className="text-lg font-medium text-blue-500">{formattedTemp}</span>
		</div>
	);
}
