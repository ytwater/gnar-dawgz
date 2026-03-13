// Weather components - centralized exports
// 
// IMPORTANT: Temperature Data Sources
// - TemperatureDisplay, CurrentConditions, ForecastCard, FiveDayForecast
//   -> Use AIR temperature from weather API (OpenWeatherMap, WeatherAPI, etc.)
// 
// - WaterTemperatureDisplay
//   -> Use WATER temperature from Surfline API
//
// Do NOT mix these data sources!

export { TemperatureDisplay } from './TemperatureDisplay';
export { CurrentConditions } from './CurrentConditions';
export { ForecastCard } from './ForecastCard';
export { FiveDayForecast } from './FiveDayForecast';
export { WaterTemperatureDisplay } from './WaterTemperatureDisplay';