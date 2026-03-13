# Implementation Plan

## Overall Approach

The issue is that we're incorrectly displaying water temperature (from Surfline) as air temperature in the 5-day forecast. Water temperature is typically reported in Celsius by Surfline, which explains the 17°F vs 17°C discrepancy. We need to ensure all temperature displays use the weather API's air temperature data (which should already be in Fahrenheit) instead of Surfline's water temperature data.

This is a display/data mapping issue, not a conversion problem. We'll audit all temperature displays to ensure they reference the correct data source.

## Files to Create or Modify

### 1. **Audit & Identify Affected Components**
First, locate all components displaying temperature data:
- `components/FiveDayForecast.jsx` (or similar) - Primary issue location
- `components/CurrentConditions.jsx` - Likely affected
- `components/HourlyForecast.jsx` - May be affected
- Any weather card/widget components

### 2. **Fix: 5-Day Forecast Component**
**File**: `components/FiveDayForecast.jsx` (or equivalent)

**Changes**:
- **Before**: Currently accessing `surflineData.temperature` or similar
- **After**: Access `weatherData.temperature` or `weatherData.temp` 
- Ensure we're mapping to the weather API response, not Surfline response
- Verify the temperature field name from weather API (likely `temp`, `temperature`, or `temp_f`)

**Example pseudocode**:
```javascript
// BEFORE (incorrect)
const temperature = forecast.surfline?.temperature;

// AFTER (correct)
const temperature = forecast.weather?.temperature || forecast.weather?.temp;
```

### 3. **Fix: Other Temperature Display Components**
Apply the same fix pattern to any other components displaying air temperature:
- Review each component's data source
- Replace Surfline temperature references with weather API temperature
- Add comments distinguishing air temp vs water temp if both are used

### 4. **Add Data Source Comments**
**Files**: All components displaying temperature

**Changes**:
- Add inline comments clarifying data sources:
  ```javascript
  const airTemp = weatherData.temperature; // Air temperature from weather API (°F)
  const waterTemp = surflineData.temperature; // Water temperature from Surfline (°C)
  ```

### 5. **Optional: Create Helper Function**
**File**: `utils/weatherHelpers.js` (create if doesn't exist)

**Purpose**: Centralize temperature data extraction to prevent future confusion

```javascript
/**
 * Extracts air temperature in Fahrenheit from weather data
 * @param {Object} weatherData - Weather API response object
 * @returns {number} Temperature in Fahrenheit
 */
export const getAirTemperature = (weatherData) => {
  return weatherData?.temperature || weatherData?.temp || null;
};

/**
 * Extracts water temperature from Surfline data
 * @param {Object} surflineData - Surfline API response object
 * @returns {number} Temperature in Celsius
 */
export const getWaterTemperature = (surflineData) => {
  return surflineData?.temperature || null;
};
```

### 6. **Update Tests**
**Files**: Test files for affected components (e.g., `FiveDayForecast.test.jsx`)

**Changes**:
- Update test mocks to include proper weather API data structure
- Add test case verifying correct data source is used
- Test that air temperature (not water temperature) is displayed

```javascript
it('displays air temperature from weather API, not water temperature', () => {
  const mockData = {
    weather: { temperature: 72 },
    surfline: { temperature: 17 } // water temp in Celsius
  };
  
  render(<FiveDayForecast data={mockData} />);
  expect(screen.getByText(/72°F/i)).toBeInTheDocument();
  expect(screen.queryByText(/17/i)).not.toBeInTheDocument();
});
```

## Acceptance Criteria

1. **5-Day Forecast Displays Correct Temperature**
   - Temperature values match current air temperature from a reliable weather source (e.g., weather.com, NOAA)
   - Values display in Fahrenheit with °F suffix
   - Temperature appears reasonable for the location/season (e.g., 50-80°F range for typical conditions)

2. **All Temperature Displays Use Weather API**
   - Audit confirms no air temperature displays incorrectly use Surfline data
   - Each temperature display has clear data source (via comments or helper functions)

3. **QA Verification**
   - QA team confirms displayed temperature matches external weather sources
   - Test across multiple locations and dates
   - Verify edge cases (negative temps, extreme heat/cold if applicable)

4. **No Regressions**
   - Water temperature displays (if any exist) still show correct values
   - No breaking changes to API calls or data structures
   - All existing tests pass

5. **Code Quality**
   - Clear comments distinguish air temperature vs water temperature
   - Consistent data access patterns across components
   - Tests cover the fix and prevent regression

## Testing Checklist for QA

- [ ] 5-day forecast shows realistic temperatures (50-80°F typical range)
- [ ] Compare displayed temp against weather.com for same location/time
- [ ] Check multiple locations (different climates)
- [ ] Verify temperature updates correctly when changing locations
- [ ] Confirm °F unit is displayed
- [ ] Test on different browsers/devices
- [ ] Verify no console errors related to temperature data