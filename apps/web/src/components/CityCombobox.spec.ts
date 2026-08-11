import { describe, expect, it } from 'vitest';
import {
  UNSUPPORTED_CITY_MESSAGE,
  validateCityField,
  cityValueForSubmit,
} from './CityCombobox';

describe('validateCityField', () => {
  it('requires a city', () => {
    expect(validateCityField('')).toBe('City is required.');
  });

  it('accepts supported cities', () => {
    expect(validateCityField('Toronto')).toBeUndefined();
    expect(validateCityField('toronto')).toBeUndefined();
    expect(validateCityField('Mississauga')).toBeUndefined();
  });

  it('rejects arbitrary typed values', () => {
    expect(validateCityField('Tornto')).toBe(UNSUPPORTED_CITY_MESSAGE);
    expect(validateCityField('North York')).toBe(UNSUPPORTED_CITY_MESSAGE);
  });

  it('allows unchanged legacy values', () => {
    expect(validateCityField('Legacy Town', 'Legacy Town')).toBeUndefined();
  });
});

describe('cityValueForSubmit', () => {
  it('normalizes to canonical spelling on submit', () => {
    expect(cityValueForSubmit('toronto')).toBe('Toronto');
    expect(cityValueForSubmit('st. catharines')).toBe('St. Catharines');
  });

  it('blocks unmatched typed values', () => {
    expect(cityValueForSubmit('Tornto')).toBeNull();
  });
});
