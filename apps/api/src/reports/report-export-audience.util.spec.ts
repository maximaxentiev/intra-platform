import { describe, expect, it } from 'vitest';
import {
  assertCentreExportAudienceAllowed,
  resolveReportExportAudience,
} from './report-export-audience.util';

describe('report-export-audience.util', () => {
  it('defaults omitted audience to ops', () => {
    expect(resolveReportExportAudience(undefined)).toBe('ops');
    expect(resolveReportExportAudience('ops')).toBe('ops');
    expect(resolveReportExportAudience('centre')).toBe('centre');
  });

  it('allows centre audience with exactly one centre selected', () => {
    expect(() =>
      assertCentreExportAudienceAllowed('centre', ['11111111-1111-4111-8111-111111111111']),
    ).not.toThrow();
  });

  it('rejects centre audience when multiple centres are selected', () => {
    expect(() =>
      assertCentreExportAudienceAllowed('centre', [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ]),
    ).toThrow(/single Centre/i);
  });

  it('allows ops audience regardless of centre count', () => {
    expect(() =>
      assertCentreExportAudienceAllowed('ops', [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ]),
    ).not.toThrow();
  });
});
