import { formatTemperature, type TemperatureUnit } from '~/utils/temperatureHelpers';

interface TemperatureDisplayProps {
  /**
   * The temperature value to display
   */
  temperature: number | null | undefined;
  
  /**
   * The unit of the input temperature value
   * 'C' = Celsius (will be converted to Fahrenheit for display)
   * 'F' = Fahrenheit (displayed as-is)
   * @default 'F'
   */
  unit?: TemperatureUnit;
  
  /**
   * Additional CSS classes for styling
   */
  className?: string;
  
  /**
   * Size variant for the temperature display
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl font-semibold',
};

/**
 * TemperatureDisplay component for consistent temperature rendering across the app.
 * Always displays temperature in Fahrenheit (°F).
 * 
 * NOTE: This component is for AIR temperature display.
 * For water temperature from Surfline, use a separate WaterTemperatureDisplay component.
 */
export function TemperatureDisplay({
  temperature,
  unit = 'F',
  className = '',
  size = 'md',
}: TemperatureDisplayProps) {
  const formattedTemp = formatTemperature(temperature, unit);
  
  return (
    <span className={`${sizeClasses[size]} ${className}`}>
      {formattedTemp}
    </span>
  );
}