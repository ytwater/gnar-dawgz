/**
 * Temperature utility functions for converting and formatting temperatures.
 * All public display should use Fahrenheit (°F).
 * 
 * IMPORTANT: This handles AIR temperature from weather APIs.
 * Do NOT confuse with WATER temperature from Surfline API.
 */

/**
 * Converts Celsius to Fahrenheit
 * @param celsius - Temperature in Celsius
 * @returns Temperature in Fahrenheit, rounded to nearest integer
 */
export const celsiusToFahrenheit = (celsius: number): number => {
  if (typeof celsius !== 'number' || Number.isNaN(celsius)) {
    return 0;
  }
  return Math.round((celsius * 9) / 5 + 32);
};

/**
 * Converts Fahrenheit to Celsius
 * @param fahrenheit - Temperature in Fahrenheit
 * @returns Temperature in Celsius, rounded to nearest integer
 */
export const fahrenheitToCelsius = (fahrenheit: number): number => {
  if (typeof fahrenheit !== 'number' || Number.isNaN(fahrenheit)) {
    return 0;
  }
  return Math.round(((fahrenheit - 32) * 5) / 9);
};

/**
 * Temperature unit type
 */
export type TemperatureUnit = 'C' | 'F';

/**
 * Formats temperature for display in Fahrenheit
 * @param temp - Temperature value
 * @param unit - Current unit of the temperature ('C' for Celsius, 'F' for Fahrenheit)
 * @returns Formatted temperature string in Fahrenheit with °F symbol
 */
export const formatTemperature = (
  temp: number | null | undefined,
  unit: TemperatureUnit = 'F'
): string => {
  if (temp === null || temp === undefined || typeof temp !== 'number' || Number.isNaN(temp)) {
    return '--°F';
  }
  
  const fahrenheit = unit === 'C' ? celsiusToFahrenheit(temp) : Math.round(temp);
  return `${fahrenheit}°F`;
};

/**
 * Formats temperature for display with customizable output unit
 * @param temp - Temperature value
 * @param inputUnit - Unit of the input temperature ('C' or 'F')
 * @param outputUnit - Desired output unit ('C' or 'F')
 * @returns Formatted temperature string with appropriate symbol
 */
export const formatTemperatureWithUnit = (
  temp: number | null | undefined,
  inputUnit: TemperatureUnit = 'F',
  outputUnit: TemperatureUnit = 'F'
): string => {
  if (temp === null || temp === undefined || typeof temp !== 'number' || Number.isNaN(temp)) {
    return `--°${outputUnit}`;
  }

  let convertedTemp: number;
  
  if (inputUnit === outputUnit) {
    convertedTemp = Math.round(temp);
  } else if (inputUnit === 'C' && outputUnit === 'F') {
    convertedTemp = celsiusToFahrenheit(temp);
  } else {
    convertedTemp = fahrenheitToCelsius(temp);
  }

  return `${convertedTemp}°${outputUnit}`;
};

/**
 * Gets the raw temperature value in Fahrenheit (without formatting)
 * @param temp - Temperature value
 * @param unit - Current unit of the temperature
 * @returns Temperature in Fahrenheit as a number, or null if invalid
 */
export const getTemperatureInFahrenheit = (
  temp: number | null | undefined,
  unit: TemperatureUnit = 'F'
): number | null => {
  if (temp === null || temp === undefined || typeof temp !== 'number' || Number.isNaN(temp)) {
    return null;
  }
  
  return unit === 'C' ? celsiusToFahrenheit(temp) : Math.round(temp);
};

/**
 * Validates if a temperature value is within reasonable bounds for air temperature
 * @param tempFahrenheit - Temperature in Fahrenheit
 * @returns true if temperature is within reasonable range (-100°F to 150°F)
 */
export const isReasonableAirTemperature = (tempFahrenheit: number): boolean => {
  return tempFahrenheit >= -100 && tempFahrenheit <= 150;
};

/**
 * Detects if a temperature value might be in the wrong unit
 * Helps identify if Celsius values are being displayed as Fahrenheit
 * @param displayedValue - The temperature value being displayed
 * @param expectedRangeLow - Expected low temperature for the location/season
 * @param expectedRangeHigh - Expected high temperature for the location/season
 * @returns Object with analysis results
 */
export const analyzeTemperatureValue = (
  displayedValue: number,
  expectedRangeLow: number = 30,
  expectedRangeHigh: number = 100
): {
  likelyCorrect: boolean;
  possiblyWrongUnit: boolean;
  suggestion: string | null;
} => {
  const isInExpectedRange = displayedValue >= expectedRangeLow && displayedValue <= expectedRangeHigh;
  
  // If displaying a Celsius value as Fahrenheit, converting back would give reasonable result
  const asIfCelsius = celsiusToFahrenheit(displayedValue);
  const convertedWouldBeReasonable = asIfCelsius >= expectedRangeLow && asIfCelsius <= expectedRangeHigh;
  
  if (isInExpectedRange) {
    return {
      likelyCorrect: true,
      possiblyWrongUnit: false,
      suggestion: null,
    };
  }
  
  if (!isInExpectedRange && convertedWouldBeReasonable) {
    return {
      likelyCorrect: false,
      possiblyWrongUnit: true,
      suggestion: `Value ${displayedValue}°F seems low. If it's actually ${displayedValue}°C, that would be ${asIfCelsius}°F`,
    };
  }
  
  return {
    likelyCorrect: false,
    possiblyWrongUnit: false,
    suggestion: `Temperature ${displayedValue}°F is outside expected range`,
  };
};