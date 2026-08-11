import { BadRequestException } from '@nestjs/common';
import {
  UNSUPPORTED_CITY_MESSAGE,
  normalizeSupportedCity,
  resolveCityForCreate,
  resolveCityForUpdate,
} from '@intra/shared';

export { UNSUPPORTED_CITY_MESSAGE };

export function assertCityForCreate(city: string): string {
  const normalized = resolveCityForCreate(city);
  if (!normalized) {
    throw new BadRequestException(UNSUPPORTED_CITY_MESSAGE);
  }
  return normalized;
}

export function assertCityForUpdate(nextCity: string, previousCity: string): string {
  const result = resolveCityForUpdate(nextCity, previousCity);
  if (!result.ok) {
    throw new BadRequestException(result.message);
  }
  return result.city;
}

export function normalizeCityForCsv(city: string): string | null {
  return normalizeSupportedCity(city);
}
