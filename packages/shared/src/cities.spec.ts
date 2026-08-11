import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_CITIES,
  filterSupportedCities,
  isSupportedCity,
  normalizeSupportedCity,
  resolveCityForCreate,
  resolveCityForUpdate,
} from './cities';

describe('supported cities catalog', () => {
  it('contains exactly 52 unique canonical values', () => {
    expect(SUPPORTED_CITIES).toHaveLength(52);
    expect(new Set(SUPPORTED_CITIES).size).toBe(52);
  });

  it('normalizes case-insensitively and trims whitespace', () => {
    expect(normalizeSupportedCity('toronto')).toBe('Toronto');
    expect(normalizeSupportedCity('TORONTO')).toBe('Toronto');
    expect(normalizeSupportedCity(' Toronto ')).toBe('Toronto');
    expect(normalizeSupportedCity('sault ste. marie')).toBe('Sault Ste. Marie');
    expect(normalizeSupportedCity('st. catharines')).toBe('St. Catharines');
    expect(normalizeSupportedCity('clarence-rockland')).toBe('Clarence-Rockland');
  });

  it('rejects unknown cities without fuzzy matching', () => {
    expect(normalizeSupportedCity('Tornto')).toBeNull();
    expect(normalizeSupportedCity('North York')).toBeNull();
    expect(normalizeSupportedCity('Oakville')).toBeNull();
    expect(resolveCityForCreate('Tornto')).toBeNull();
    expect(isSupportedCity('City')).toBe(false);
  });

  it('filters cities while typing', () => {
    expect(filterSupportedCities('tor')).toEqual(['Toronto']);
    expect(filterSupportedCities('ott')).toEqual(['Ottawa']);
    expect(filterSupportedCities('st.')).toEqual(['St. Catharines', 'St. Thomas']);
  });

  it('allows unchanged legacy values on update', () => {
    expect(resolveCityForUpdate('Legacy Town', 'Legacy Town')).toEqual({
      ok: true,
      city: 'Legacy Town',
    });
  });

  it('requires canonical city when value changes', () => {
    expect(resolveCityForUpdate('Tornto', 'Legacy Town')).toEqual({
      ok: false,
      message: 'City must be selected from the supported city list.',
    });
    expect(resolveCityForUpdate('toronto', 'Legacy Town')).toEqual({
      ok: true,
      city: 'Toronto',
    });
  });
});
