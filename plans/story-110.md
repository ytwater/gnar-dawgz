# Implementation Plan

## Overall Approach

This is a data display bug where we're incorrectly showing water temperature (from Surfline) instead of air temperature (from weather data) and/or displaying Celsius values as if they were Fahrenheit. The fix involves identifying where temperature is being rendered and ensuring we're:
1. Using the correct temperature source (weather API, not Surfline water temperature)
2. Converting Celsius to Fahrenheit if necessary
3. Always displaying in Fahrenheit with the °F symbol

Since we shouldn't modify the API or database, this is purely a frontend/presentation layer fix.

## Investigation Phase

### 1. Audit Temperature Display Locations
- [ ] Review the 5-day forecast component to identify where temperature is sourced
- [ ] Search codebase for all temperature-related rendering (search for: `temperature`, `temp`, `°`, `degrees`, Surfline temperature references)
- [ ] Document all locations where temperature is displayed (forecast cards, current conditions, detail views, etc.)
- [ ] Verify which data source each location is currently using

### 2. Analyze Data Structure
- [ ] Examine the Surfline API response structure to confirm water temperature field names
- [ ] Examine the weather API response structure to identify air temperature fields
- [ ] Determine if weather API returns Celsius or Fahrenheit
- [ ] Check if any existing conversion utilities exist in the codebase

## Implementation Phase

### Files to Create

**`src/utils/temperatureHelpers.js` (or appropriate location)**
```javascript
/**
 * Converts Celsius to Fahrenheit
 * @param {number} celsius - Temperature in Celsius
 * @returns {number} Temperature in Fahrenheit, rounded to nearest integer
 */
export const celsiusToFahrenheit = (celsius) => {
  return Math.round((celsius * 9/5) + 32);
};

/**
 * Formats temperature for display
 * @param {number} temp - Temperature value
 * @param {string} unit - Current unit ('C' or 'F')
 * @returns {string} Formatted temperature string in Fahrenheit
 */
export const formatTemperature = (temp, unit = 'F') => {
  const fahrenheit = unit === 'C' ? celsiusToFahrenheit(temp) : temp;
  return `${fahrenheit}°F`;
};
```

**`src/utils/__tests__/temperatureHelpers.test.js`**
- Unit tests for conversion function (0°C = 32°F, 17°C = 63°F, 100°C = 212°F)
- Unit tests for formatTemperature function
- Edge case tests (negative temps, decimals, null/undefined handling)

### Files to Modify

**Primary Target: 5-Day Forecast Component** (exact path TBD during investigation)
- [ ] Locate the forecast component (likely `ForecastCard.js`, `FiveDayForecast.js`, or similar)
- [ ] Update to use `weather.temperature` instead of `surfline.temperature`
- [ ] Apply `formatTemperature()` utility to the weather temperature value
- [ ] Add PropTypes/TypeScript validation to ensure correct data structure

**Example change:**
```javascript
// BEFORE
<div className="temperature">
  {surfline.temperature}°F  // Actually showing water temp in Celsius
</div>

// AFTER
import { formatTemperature } from '@/utils/temperatureHelpers';

<div className="temperature">
  {formatTemperature(weather.temperature, weather.unit || 'F')}
</div>
```

**Additional Components** (identified during audit phase)
- [ ] Current conditions display component
- [ ] Detailed forecast view
- [ ] Any weather widget or summary cards
- [ ] Mobile-specific temperature displays
- Apply same fix pattern: use weather data source + formatTemperature utility

**Data Fetching Layer** (if necessary)
- [ ] Review weather API integration to ensure air temperature is being fetched
- [ ] Verify the response mapping includes temperature field from weather service
- [ ] Add comments distinguishing weather.temperature (air) from surfline.temperature (water)

## Verification & Testing

### Manual QA Checklist
- [ ] 5-day forecast displays reasonable Fahrenheit values (not 17°F when it's actually warm)
- [ ] Current temperature matches reference sources (weather.com, NOAA)
- [ ] All identified temperature displays show °F symbol
- [ ] Temperature values are consistent across different views
- [ ] Mobile and desktop views both display correctly
- [ ] Test in different geographic locations/API responses

### Automated Testing
- [ ] Unit tests for temperature conversion utility (100% coverage)
- [ ] Component tests verifying correct data source is used
- [ ] Integration tests for forecast components
- [ ] Visual regression tests for temperature display formatting

### Edge Cases to Test
- [ ] Negative temperatures (below 0°F)
- [ ] Very high temperatures (>100°F)
- [ ] Null/undefined temperature values (graceful degradation)
- [ ] API returns data in unexpected format

## Acceptance Criteria

1. **Correct Data Source**: All temperature displays use air temperature from weather API, NOT water temperature from Surfline
2. **Correct Units**: All temperatures display in Fahrenheit with °F symbol
3. **Accurate Values**: Temperatures match reference weather sources within ±2°F
4. **5-Day Forecast Fixed**: The reported bug (17°F showing as current temp) is resolved
5. **No Regressions**: All other temperature displays remain functional
6. **Code Quality**: Temperature handling is centralized in a reusable utility function
7. **Test Coverage**: New utility has 100% unit test coverage
8. **Documentation**: Code comments clearly distinguish water temp vs air temp data sources

## Rollback Plan

- Changes are isolated to presentation layer only
- No database or API modifications means easy rollback via git revert
- Feature flag consideration: If widespread changes, wrap in feature toggle for gradual rollout

## Estimated Effort

- Investigation & Audit: 2-3 hours
- Implementation: 3-4 hours
- Testing & QA: 2-3 hours
- **Total: 7-10 hours (1-1.5 days)**