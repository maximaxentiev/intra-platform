import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CentreUsageQueryDto } from './centre-usage-query.dto';
import {
  normalizeReportCitiesList,
  parseReportCities,
  resolveReportCitiesFilter,
} from './report-cities.util';

describe('parseReportCities', () => {
  it('parses comma-separated canonical cities', () => {
    expect(parseReportCities('Toronto,Ottawa')).toEqual(['Toronto', 'Ottawa']);
  });

  it('returns undefined for empty input', () => {
    expect(parseReportCities(undefined)).toBeUndefined();
    expect(parseReportCities('')).toBeUndefined();
  });
});

describe('normalizeReportCitiesList', () => {
  it('normalizes case-insensitive supported cities', () => {
    expect(normalizeReportCitiesList(['toronto', 'ottawa'])).toEqual(['Toronto', 'Ottawa']);
  });

  it('returns raw values when a city is unsupported', () => {
    expect(normalizeReportCitiesList(['Toronto', 'Tornto'])).toEqual(['Toronto', 'Tornto']);
  });
});

describe('resolveReportCitiesFilter', () => {
  it('returns null when no cities are selected', () => {
    expect(resolveReportCitiesFilter(undefined)).toBeNull();
    expect(resolveReportCitiesFilter([])).toBeNull();
  });
});

describe('CentreUsageQueryDto cities validation', () => {
  it('accepts canonical cities', () => {
    const dto = plainToInstance(CentreUsageQueryDto, { cities: 'Toronto,Mississauga' });
    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
    expect(dto.cities).toEqual(['Toronto', 'Mississauga']);
  });

  it('rejects unsupported city values', () => {
    const dto = plainToInstance(CentreUsageQueryDto, { cities: 'Tornto' });
    const errors = validateSync(dto);
    expect(errors.some((error) => error.property === 'cities')).toBe(true);
  });
});
