import { formatTemperature, type TemperatureUnit } from '~/utils/temperatureHelpers';
import { TemperatureDisplay } from './TemperatureDisplay';

interface ForecastDay {
  date: string;
  dayOfWeek: string;
  /**
   * High temperature - should come from weather API, NOT Surfline
   */
  highTemp: number | null;
  /**
   * Low temperature - should come from weather API, NOT Surfline
   */
  lowTemp: number | null;
  /**
   * The unit of the temperature values from the API
   */
  tempUnit?: TemperatureUnit;
  condition: string;
  icon?: string;
}

interface ForecastCardProps {
  forecast: ForecastDay;
  className?: string;
}

/**
 * Individual forecast card for a single day.
 * Displays AIR temperature from weather API (NOT water temperature from Surfline).
 */
export function ForecastCard({ forecast, className = '' }: ForecastCardProps) {
  const { dayOfWeek, highTemp, lowTemp, tempUnit = 'F', condition, icon } = forecast;
  
  return (
    <div className={`flex flex-col items-center p-4 rounded-lg bg-card ${className}`}>
      <span className="text-sm font-medium text-muted-foreground">{dayOfWeek}</span>
      
      {icon && (
        <div className="my-2">
          <img src={icon} alt={condition} className="w-10 h-10" />
        </div>
      )}
      
      <div className="flex flex-col items-center gap-1">
        {/* High temperature - AIR temp from weather API */}
        <TemperatureDisplay 
          temperature={highTemp} 
          unit={tempUnit} 
          size="lg"
          className="font-semibold"
        />
        
        {/* Low temperature - AIR temp from weather API */}
        <TemperatureDisplay 
          temperature={lowTemp} 
          unit={tempUnit} 
          size="sm"
          className="text-muted-foreground"
        />
      </div>
      
      <span className="mt-2 text-xs text-muted-foreground">{condition}</span>
    </div>
  );
}