import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  assertCityForCreate,
  assertCityForUpdate,
  normalizeCityForCsv,
} from './city-validation';

describe('city-validation', () => {
  it('accepts canonical cities on create', () => {
    expect(assertCityForCreate('toronto')).toBe('Toronto');
    expect(assertCityForCreate('Ottawa')).toBe('Ottawa');
  });

  it('rejects arbitrary cities on create', () => {
    expect(() => assertCityForCreate('Tornto')).toThrow(BadRequestException);
  });

  it('allows unchanged legacy values on update', () => {
    expect(assertCityForUpdate('Legacy Town', 'Legacy Town')).toBe('Legacy Town');
  });

  it('requires canonical city when value changes', () => {
    expect(assertCityForUpdate('toronto', 'Legacy Town')).toBe('Toronto');
    expect(() => assertCityForUpdate('Tornto', 'Legacy Town')).toThrow(BadRequestException);
  });

  it('normalizes csv city values', () => {
    expect(normalizeCityForCsv('TORONTO')).toBe('Toronto');
    expect(normalizeCityForCsv('st. catharines')).toBe('St. Catharines');
    expect(normalizeCityForCsv('clarence-rockland')).toBe('Clarence-Rockland');
    expect(normalizeCityForCsv('Tornto')).toBeNull();
    expect(normalizeCityForCsv('North York')).toBeNull();
  });
});
