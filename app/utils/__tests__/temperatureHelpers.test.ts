import { describe, it, expect } from 'vitest';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  formatTemperature,
  formatTemperatureWithUnit,
  getTemperatureInFahrenheit,
  isReasonableAirTemperature,
  analyzeTemperatureValue,
} from '../temperatureHelpers';

describe('celsiusToFahrenheit', () => {
  it('converts 0°C to 32°F', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });

  it('converts 100°C to 212°F', () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
  });

  it('converts 17°C to 63°F (the bug case)', () => {
    expect(celsiusToFahrenheit(17)).toBe(63);
  });

  it('converts -40°C to -40°F (same in both scales)', () => {
    expect(celsiusToFahrenheit(-40)).toBe(-40);
  });

  it('converts 25°C to 77°F', () => {
    expect(celsiusToFahrenheit(25)).toBe(77);
  });

  it('handles decimal values and rounds', () => {
    expect(celsiusToFahrenheit(20.5)).toBe(69);
    expect(celsiusToFahrenheit(20.4)).toBe(69);
  });

  it('handles negative temperatures', () => {
    expect(celsiusToFahrenheit(-10)).toBe(14);
    expect(celsiusToFahrenheit(-20)).toBe(-4);
  });

  it('returns 0 for NaN', () => {
    expect(celsiusToFahrenheit(NaN)).toBe(0);
  });

  it('returns 0 for non-number values', () => {
    // @ts-expect-error Testing invalid input
    expect(celsiusToFahrenheit('25')).toBe(0);
    // @ts-expect-error Testing invalid input
    expect(celsiusToFahrenheit(undefined)).toBe(0);
    // @ts-expect-error Testing invalid input
    expect(celsiusToFahrenheit(null)).toBe(0);
  });
});

describe('fahrenheitToCelsius', () => {
  it('converts 32°F to 0°C', () => {
    expect(fahrenheitToCelsius(32)).toBe(0);
  });

  it('converts 212°F to 100°C', () => {
    expect(fahrenheitToCelsius(212)).toBe(100);
  });

  it('converts 77°F to 25°C', () => {
    expect(fahrenheitToCelsius(77)).toBe(25);
  });

  it('handles negative temperatures', () => {
    expect(fahrenheitToCelsius(-4)).toBe(-20);
  });

  it('returns 0 for invalid inputs', () => {
    expect(fahrenheitToCelsius(NaN)).toBe(0);
    // @ts-expect-error Testing invalid input
    expect(fahrenheitToCelsius(null)).toBe(0);
  });
});

describe('formatTemperature', () => {
  it('formats Fahrenheit value correctly', () => {
    expect(formatTemperature(75, 'F')).toBe('75°F');
  });

  it('converts Celsius to Fahrenheit and formats', () => {
    expect(formatTemperature(17, 'C')).toBe('63°F');
  });

  it('defaults to Fahrenheit unit', () => {
    expect(formatTemperature(75)).toBe('75°F');
  });

  it('handles null value', () => {
    expect(formatTemperature(null)).toBe('--°F');
  });

  it('handles undefined value', () => {
    expect(formatTemperature(undefined)).toBe('--°F');
  });

  it('handles NaN value', () => {
    expect(formatTemperature(NaN)).toBe('--°F');
  });

  it('rounds decimal values', () => {
    expect(formatTemperature(75.6, 'F')).toBe('76°F');
    expect(formatTemperature(75.4, 'F')).toBe('75°F');
  });

  it('handles negative temperatures', () => {
    expect(formatTemperature(-10, 'F')).toBe('-10°F');
    expect(formatTemperature(-10, 'C')).toBe('14°F');
  });

  it('handles zero temperature', () => {
    expect(formatTemperature(0, 'C')).toBe('32°F');
    expect(formatTemperature(0, 'F')).toBe('0°F');
  });
});

describe('formatTemperatureWithUnit', () => {
  it('formats with same input and output unit', () => {
    expect(formatTemperatureWithUnit(75, 'F', 'F')).toBe('75°F');
    expect(formatTemperatureWithUnit(25, 'C', 'C')).toBe('25°C');
  });

  it('converts C to F', () => {
    expect(formatTemperatureWithUnit(25, 'C', 'F')).toBe('77°F');
  });

  it('converts F to C', () => {
    expect(formatTemperatureWithUnit(77, 'F', 'C')).toBe('25°C');
  });

  it('handles invalid values', () => {
    expect(formatTemperatureWithUnit(null, 'F', 'F')).toBe('--°F');
    expect(formatTemperatureWithUnit(undefined, 'C', 'C')).toBe('--°C');
  });
});

describe('getTemperatureInFahrenheit', () => {
  it('returns Fahrenheit value unchanged', () => {
    expect(getTemperatureInFahrenheit(75, 'F')).toBe(75);
  });

  it('converts Celsius to Fahrenheit', () => {
    expect(getTemperatureInFahrenheit(17, 'C')).toBe(63);
  });

  it('returns null for invalid inputs', () => {
    expect(getTemperatureInFahrenheit(null)).toBe(null);
    expect(getTemperatureInFahrenheit(undefined)).toBe(null);
    expect(getTemperatureInFahrenheit(NaN)).toBe(null);
  });

  it('rounds decimal values', () => {
    expect(getTemperatureInFahrenheit(75.6, 'F')).toBe(76);
  });
});

describe('isReasonableAirTemperature', () => {
  it('returns true for typical temperatures', () => {
    expect(isReasonableAirTemperature(70)).toBe(true);
    expect(isReasonableAirTemperature(32)).toBe(true);
    expect(isReasonableAirTemperature(100)).toBe(true);
  });

  it('returns true for extreme but possible temperatures', () => {
    expect(isReasonableAirTemperature(-50)).toBe(true);
    expect(isReasonableAirTemperature(130)).toBe(true);
  });

  it('returns false for unreasonable temperatures', () => {
    expect(isReasonableAirTemperature(-150)).toBe(false);
    expect(isReasonableAirTemperature(200)).toBe(false);
  });
});

describe('analyzeTemperatureValue', () => {
  it('identifies likely correct temperature', () => {
    const result = analyzeTemperatureValue(75, 30, 100);
    expect(result.likelyCorrect).toBe(true);
    expect(result.possiblyWrongUnit).toBe(false);
  });

  it('identifies temperature that might be in wrong unit', () => {
    // 17°F is suspiciously low, but 17°C = 63°F which is reasonable
    const result = analyzeTemperatureValue(17, 30, 100);
    expect(result.likelyCorrect).toBe(false);
    expect(result.possiblyWrongUnit).toBe(true);
    expect(result.suggestion).toContain('63°F');
  });

  it('handles temperature outside any reasonable range', () => {
    const result = analyzeTemperatureValue(-50, 30, 100);
    expect(result.likelyCorrect).toBe(false);
  });
});