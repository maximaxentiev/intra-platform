import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { minimumWorkPermitExpiryDate } from './network-submit-toronto-date.util';
import { buildNannyV2ApplicationJson } from './network-submit-nanny.test-fixtures';
import {
  assertRequiredDocumentsPresent,
  parseNetworkApplicationJson,
} from './network-submit.validation';
import { RESUME_MAX_FILE_BYTES } from './network-submit.constants';

vi.mock('../availability/availability-toronto.util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../availability/availability-toronto.util')>();
  return {
    ...actual,
    torontoTodayDateString: vi.fn(() => '2026-03-10'),
  };
});

describe('Nanny v2 network submit validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function parsePayload(overrides: Parameters<typeof buildNannyV2ApplicationJson>[0] = {}) {
    const json = buildNannyV2ApplicationJson(overrides);
    return parseNetworkApplicationJson(JSON.stringify(json));
  }

  it('accepts a complete valid payload', () => {
    const parsed = parsePayload();
    expect(parsed.intakeVersion).toBe('nanny_v2');
    expect(parsed.applicant.city).toBe('Toronto');
    assertRequiredDocumentsPresent(parsed);
  });

  it('rejects GTA commute false', () => {
    expect(() => parsePayload({ canCommuteGta: false })).toThrow(/commute/i);
  });

  it.each(['No', 'Unsure'] as const)('rejects legal authorization %s', (answer) => {
    expect(() => parsePayload({ legallyAuthorizedToWork: answer })).toThrow(/legally authorized/i);
  });

  it('accepts work permit expiry exactly six months out', () => {
    const expiry = minimumWorkPermitExpiryDate('2026-03-10');
    expect(expiry).toBe('2026-09-10');
    const parsed = parsePayload({
      canadaStatus: 'Open work permit',
      workPermitExpiry: expiry,
      workPermitChildcareRestrictions: 'No',
    });
    expect(parsed.eligibilityExtended?.workPermitExpiry).toBe(expiry);
  });

  it('rejects work permit expiry one day before six months', () => {
    expect(() =>
      parsePayload({
        canadaStatus: 'Open work permit',
        workPermitExpiry: '2026-09-09',
        workPermitChildcareRestrictions: 'No',
      }),
    ).toThrow(/six months/i);
  });

  it.each(['Yes', 'Unsure'] as const)('rejects childcare restriction %s', (answer) => {
    expect(() =>
      parsePayload({
        canadaStatus: 'Open work permit',
        workPermitExpiry: '2027-01-01',
        workPermitChildcareRestrictions: answer,
      }),
    ).toThrow(/childcare/i);
  });

  it.each(['No', 'Unsure'] as const)('rejects study off-campus %s', (answer) => {
    expect(() =>
      parsePayload({
        canadaStatus: 'Study permit',
        authorizedOffCampus: answer,
        workHourLimitStatus: 'No',
      }),
    ).toThrow(/off-campus/i);
  });

  it('accepts non-hard-stop paths', () => {
    expect(() =>
      parsePayload({
        hasChildcareExperience: false,
        firstAidStatus: 'No',
        firstAidExpiry: null,
        vscStatus: 'No but I am willing to obtain one',
        vscIssueDate: null,
        educationCertifications: ['None'],
        educationProgramName: null,
        spokenEnglishRating: 1,
        canadaStatus: 'Study permit',
        authorizedOffCampus: 'Yes',
        workHourLimitStatus: 'Unsure',
        maxWeeklyWorkHours: null,
      }),
    ).not.toThrow();
  });

  it('rejects mutually exclusive experience types', () => {
    expect(() =>
      parsePayload({
        experienceTypes: ['Nanny', 'No previous childcare experience'],
      }),
    ).toThrow(/No previous childcare experience/i);
  });

  it('rejects spokenEnglishRating outside 1–10', () => {
    expect(() => parsePayload({ spokenEnglishRating: 0 })).toThrow(/1 and 10/i);
    expect(() => parsePayload({ spokenEnglishRating: 11 })).toThrow(/1 and 10/i);
  });

  it('rejects nanny resume PNG', () => {
    const json = buildNannyV2ApplicationJson();
    json.documents = [
      {
        id: randomUUID(),
        category: 'resume',
        originalFilename: 'resume.png',
        contentType: 'image/png',
        size: 1024,
      },
    ];
    expect(() => parseNetworkApplicationJson(JSON.stringify(json))).toThrow(/disallowed/i);
  });

  it('accepts nanny resume exactly 10 MB', () => {
    const json = buildNannyV2ApplicationJson();
    json.documents[0].size = RESUME_MAX_FILE_BYTES;
    const parsed = parseNetworkApplicationJson(JSON.stringify(json));
    expect(parsed.documents[0]?.size).toBe(RESUME_MAX_FILE_BYTES);
  });

  it('rejects VSC document when vscStatus is not Yes', () => {
    const json = buildNannyV2ApplicationJson({ vscStatus: 'No' });
    json.documents.push({
      id: crypto.randomUUID(),
      category: 'vulnerable_sector_check',
      originalFilename: 'vsc.pdf',
      contentType: 'application/pdf',
      size: 1024,
    });
    expect(() => parseNetworkApplicationJson(JSON.stringify(json))).toThrow(/not allowed/i);
  });

  it('accepts optional VSC HEIC when vscStatus is Yes', () => {
    const json = buildNannyV2ApplicationJson({ vscStatus: 'Yes', vscIssueDate: '2026-01-01' });
    json.documents.push({
      id: crypto.randomUUID(),
      category: 'vulnerable_sector_check',
      originalFilename: 'vsc.heic',
      contentType: 'image/heic',
      size: 1024,
    });
    const parsed = parseNetworkApplicationJson(JSON.stringify(json));
    expect(parsed.documents).toHaveLength(2);
  });

  it('requires exact consent policy version', () => {
    expect(() => parsePayload({ consentPolicyVersion: '2026-07-01' })).toThrow(/consentPolicyVersion/i);
  });
});
