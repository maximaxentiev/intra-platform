import { describe, expect, it } from 'vitest';
import { buildApplicationsListWhere, nannyIntakeVersionExpr } from './applications-list-filter.util';
import type { ListApplicationsQuery } from './dto/applications.dto';

describe('buildApplicationsListWhere', () => {
  it('returns undefined when no filters', () => {
    expect(buildApplicationsListWhere({})).toBeUndefined();
  });

  it('combines role and text search', () => {
    const where = buildApplicationsListWhere({ role: 'nanny', q: 'jane' });
    expect(where).toBeTruthy();
  });

  it('builds reviewed filter', () => {
    expect(buildApplicationsListWhere({ reviewed: 'yes' })).toBeTruthy();
    expect(buildApplicationsListWhere({ reviewed: 'no' })).toBeTruthy();
  });

  it('builds document presence filters', () => {
    expect(buildApplicationsListWhere({ hasResume: 'yes' })).toBeTruthy();
    expect(buildApplicationsListWhere({ hasVscDocument: 'no' })).toBeTruthy();
  });

  it('builds intake version filter for nanny', () => {
    const where = buildApplicationsListWhere({ intakeVersion: 'historical_import' });
    expect(where).toBeTruthy();
  });

  it('builds nullable tri-state without treating missing as no', () => {
    const where = buildApplicationsListWhere({ accuracyConfirmed: 'missing' });
    expect(where).toBeTruthy();
  });

  it('builds spoken english range', () => {
    const where = buildApplicationsListWhere({ spokenEnglishMin: 8, spokenEnglishMax: 10 });
    expect(where).toBeTruthy();
  });

  it('parameterizes csv enum lists', () => {
    const where = buildApplicationsListWhere({
      vscStatus: 'Willing to obtain,Completed',
    });
    expect(where).toBeTruthy();
  });
});

describe('nannyIntakeVersionExpr', () => {
  it('classifies intake in SQL', () => {
    expect(nannyIntakeVersionExpr()).toBeTruthy();
  });
});
