import { TemperatureDisplay } from './TemperatureDisplay';
import { formatTemperature, type TemperatureUnit } from '~/utils/temperatureHelpers';

interface CurrentConditionsProps {
  /**
   * Current AIR temperature from weather API.
   * NOT water temperature from Surfline.
   */
  temperature: number | null | undefined;
  /**
   * Unit of the temperature value from the API
   */
  temperatureUnit?: TemperatureUnit;
  /**
   * "Feels like" temperature from weather API
   */
  feelsLike?: number | null;
  /**
   * Weather condition description (e.g., "Partly Cloudy")
   */
  condition?: string;
  /**
   * Humidity percentage
   */
  humidity?: number | null;
  /**
   * Wind speed (in mph)
   */
  windSpeed?: number | null;
  /**
   * Wind direction (e.g., "NW")
   */
  windDirection?: string;
  /**
   * Weather icon URL or identifier
   */
  icon?: string;
  /**
   * Location name
   */
  location?: string;
  className?: string;
}

/**
 * CurrentConditions component displays the current weather conditions.
 * 
 * IMPORTANT: This displays AIR temperature from weather API.
 * For surf spot water temperature, use a separate component.
 * 
 * All temperatures are displayed in Fahrenheit (°F).
 */
export function CurrentConditions({
  temperature,
  temperatureUnit = 'F',
  feelsLike,
  condition,
  humidity,
  windSpeed,
  windDirection,
  icon,
  location,
  className = '',
}: CurrentConditionsProps) {
  return (
    <div className={`flex flex-col gap-4 p-6 rounded-lg bg-card ${className}`}>
      {location && (
        <h2 className="text-lg font-semibold">{location}</h2>
      )}
      
      <div className="flex items-center gap-4">
        {icon && (
          <img src={icon} alt={condition || 'Weather'} className="w-16 h-16" />
        )}
        
        <div className="flex flex-col">
          {/* Current AIR temperature - from weather API */}
          <TemperatureDisplay 
            temperature={temperature}
            unit={temperatureUnit}
            size="xl"
          />
          
          {feelsLike !== null && feelsLike !== undefined && (
            <span className="text-sm text-muted-foreground">
              Feels like {formatTemperature(feelsLike, temperatureUnit)}
            </span>
          )}
        </div>
      </div>
      
      {condition && (
        <p className="text-base">{condition}</p>
      )}
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        {humidity !== null && humidity !== undefined && (
          <div className="flex flex-col">
            <span className="text-muted-foreground">Humidity</span>
            <span className="font-medium">{humidity}%</span>
          </div>
        )}
        
        {windSpeed !== null && windSpeed !== undefined && (
          <div className="flex flex-col">
            <span className="text-muted-foreground">Wind</span>
            <span className="font-medium">
              {windSpeed} mph {windDirection || ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}