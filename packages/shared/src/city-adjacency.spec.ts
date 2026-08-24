import { describe, expect, it } from 'vitest';
import { SUPPORTED_CITIES, type SupportedCity } from './cities';
import {
  CITY_ADJACENCY_EDGES,
  adjacentCities,
  cityGraphDistance,
  geographicTier,
} from './city-adjacency';

describe('city adjacency graph', () => {
  it('includes every edge endpoint in SUPPORTED_CITIES', () => {
    for (const [left, right] of CITY_ADJACENCY_EDGES) {
      expect(SUPPORTED_CITIES).toContain(left);
      expect(SUPPORTED_CITIES).toContain(right);
    }
  });

  it('has no self edges', () => {
    for (const [left, right] of CITY_ADJACENCY_EDGES) {
      expect(left).not.toBe(right);
    }
  });

  it('is undirected via reverse lookup', () => {
    for (const [left, right] of CITY_ADJACENCY_EDGES) {
      expect(adjacentCities(left)).toContain(right);
      expect(adjacentCities(right)).toContain(left);
    }
  });

  it('initializes all 52 canonical cities as graph nodes', () => {
    expect(SUPPORTED_CITIES).toHaveLength(52);
    for (const city of SUPPORTED_CITIES) {
      expect(adjacentCities(city)).toEqual(expect.any(Array));
    }
  });

  it('does not duplicate undirected edges in the edge list', () => {
    const seen = new Set<string>();
    for (const [left, right] of CITY_ADJACENCY_EDGES) {
      const key = [left, right].sort().join('|');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('returns same distance regardless of duplicate edge traversal', () => {
    expect(cityGraphDistance('Toronto', 'Mississauga')).toBe(1);
    expect(cityGraphDistance('Mississauga', 'Toronto')).toBe(1);
  });

  it('is not altered by cycles in the graph', () => {
    expect(cityGraphDistance('Toronto', 'Vaughan')).toBe(1);
    expect(cityGraphDistance('Vaughan', 'Markham')).toBe(1);
    expect(cityGraphDistance('Markham', 'Richmond Hill')).toBe(1);
    expect(cityGraphDistance('Toronto', 'Richmond Hill')).toBe(1);
  });

  describe('cityGraphDistance', () => {
    it('returns 0 for the same city', () => {
      expect(cityGraphDistance('Toronto', 'Toronto')).toBe(0);
    });

    it('returns 1 for direct neighbors', () => {
      expect(cityGraphDistance('Toronto', 'Mississauga')).toBe(1);
      expect(cityGraphDistance('Hamilton', 'Burlington')).toBe(1);
    });

    it('returns 2 for second-degree neighbors without a direct edge', () => {
      expect(cityGraphDistance('Toronto', 'Oshawa')).toBe(2);
      expect(cityGraphDistance('Toronto', 'Brampton')).toBe(2);
    });

    it('prefers direct adjacency over second-degree paths', () => {
      expect(cityGraphDistance('Toronto', 'Pickering')).toBe(1);
    });

    it('returns null beyond second degree', () => {
      expect(cityGraphDistance('Toronto', 'Windsor')).toBeNull();
      expect(cityGraphDistance('Ottawa', 'Thunder Bay')).toBeNull();
    });
  });

  describe('geographicTier', () => {
    it('maps graph distance to tiers 0–2', () => {
      expect(geographicTier('Toronto', 'Toronto')).toBe(0);
      expect(geographicTier('Mississauga', 'Toronto')).toBe(1);
      expect(geographicTier('Oshawa', 'Toronto')).toBe(2);
    });

    it('returns tier 3 beyond second degree', () => {
      expect(geographicTier('Windsor', 'Toronto')).toBe(3);
    });

    it('returns tier 3 for unknown or blank staff city', () => {
      expect(geographicTier(null, 'Toronto')).toBe(3);
      expect(geographicTier('', 'Toronto')).toBe(3);
      expect(geographicTier('Legacy Town', 'Toronto')).toBe(3);
      expect(geographicTier('North York', 'Toronto')).toBe(3);
    });

    it('returns tier 3 for all staff when centre city is unknown', () => {
      expect(geographicTier('Toronto', null)).toBe(3);
      expect(geographicTier('Toronto', '')).toBe(3);
      expect(geographicTier('Mississauga', 'Legacy Town')).toBe(3);
      expect(geographicTier('Windsor', 'North York')).toBe(3);
    });

    it('normalizes case for canonical cities', () => {
      expect(geographicTier('toronto', 'TORONTO')).toBe(0);
      expect(geographicTier('mississauga', 'Toronto')).toBe(1);
    });
  });

  it('rejects invalid canonical names at compile time via SupportedCity', () => {
    const valid: SupportedCity = 'Toronto';
    expect(cityGraphDistance(valid, 'Mississauga')).toBe(1);
  });
});
