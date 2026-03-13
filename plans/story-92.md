# Implementation Plan

## Overall Approach

The issue is that we're currently displaying water temperature (in Celsius) instead of air temperature for the 5-day forecast. We need to identify where temperature is being extracted from Surfline data and ensure we're using the correct `weather.temperature` field instead of the `temperature` field (which represents water temperature). Since the data should already be in Fahrenheit from the weather object, this is primarily a data source correction rather than a conversion issue.

## Files to Create or Modify

### 1. Identify and Update Component Displaying 5-Day Forecast
**Location**: Likely `components/ForecastCard.tsx`, `components/WeeklyForecast.tsx`, or similar

**Changes**:
- Locate where temperature is being extracted from Surfline data
- Change from accessing `surflineData.temperature` or similar to `surflineData.weather.temperature`
- Ensure the temperature display includes "°F" unit indicator for clarity
- Add null/undefined checks for the weather object

**Example Change**:
```typescript
// BEFORE (incorrect - showing water temp)
const temperature = forecast.temperature;

// AFTER (correct - showing air temp)
const temperature = forecast.weather?.temperature;
```

### 2. Audit All Temperature Display Components
**Locations**: Search codebase for temperature references

**Changes**:
- Search for patterns like `.temperature`, `temp`, `Temperature` across all components
- Verify each instance is using `weather.temperature` for air temperature displays
- Document any intentional water temperature displays for future clarity
- Common locations to check:
  - Current conditions component
  - Hourly forecast component
  - Location detail pages
  - Forecast cards/widgets

### 3. Add Type Safety (if using TypeScript)
**Location**: Type definition files (e.g., `types/surfline.ts`, `types/weather.ts`)

**Changes**:
- Ensure type definitions clearly distinguish between water and air temperature
- Example structure:
```typescript
interface SurflineData {
  temperature: number; // Water temperature in Celsius
  weather: {
    temperature: number; // Air temperature in Fahrenheit
    condition: string;
    // ... other weather fields
  };
  // ... other fields
}
```

### 4. Add Data Validation/Fallback
**Location**: Data fetching/parsing layer

**Changes**:
- Add validation to ensure `weather.temperature` exists before rendering
- Provide fallback behavior if weather data is missing
- Log warnings if expected data structure is not present

### 5. Update Tests
**Location**: Test files corresponding to modified components

**Changes**:
- Update test fixtures to use correct data structure
- Add test cases verifying temperature is pulled from `weather.temperature`
- Add test cases for missing weather data graceful handling

## Acceptance Criteria

### Functional Requirements
- [ ] 5-day forecast displays air temperature in Fahrenheit (not water temperature in Celsius)
- [ ] Temperature values appear reasonable for current weather conditions (e.g., 60-80°F range, not 15-20°F)
- [ ] Temperature displays include "°F" unit indicator
- [ ] No console errors when weather data is missing or malformed

### QA Testing Scenarios
- [ ] Verify temperature on 5-day forecast for multiple locations (coastal and inland)
- [ ] Compare displayed temperature with external weather sources for same location
- [ ] Check that water temperature (if displayed elsewhere) remains unchanged
- [ ] Test with various locations during QA to ensure consistency
- [ ] Verify temperature displays correctly on mobile and desktop views

### Technical Requirements
- [ ] Code changes use `weather.temperature` instead of root-level `temperature`
- [ ] Proper null/undefined checks prevent runtime errors
- [ ] No changes required to API calls or database queries
- [ ] All existing tests pass with updated fixtures
- [ ] No unintended changes to water temperature displays (if they exist elsewhere)

### Documentation
- [ ] Add code comments distinguishing water vs. air temperature where ambiguous
- [ ] Update any developer documentation about Surfline data structure if applicable

## Rollback Plan
If issues are discovered post-deployment, revert the component changes to restore previous behavior while investigating. Since no API or database changes are involved, rollback risk is minimal.