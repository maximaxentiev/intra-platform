import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  CHILDCARE_EXPERIENCE_MAX_LENGTH,
  NETWORK_SUBMIT_MAX_FILES,
  NETWORK_SUBMIT_MAX_FILE_BYTES,
} from './network-submit.constants';
import { safeCompareSecret } from './network-submit.util';
import {
  assertRequiredDocumentsPresent,
  complianceToDbFields,
  mapCovidVaccinationStatus,
  matchSubmitFiles,
  parseNetworkApplicationJson,
} from './network-submit.validation';
import {
  buildEcaApplicationJson,
  buildLegacyLiveWebsiteEcaPayload,
  buildLegacyLiveWebsiteEcePayload,
  buildNewShapeComplianceDocuments,
  documentMeta,
  fakePdfBuffer,
  matchedFilesFromPayload,
} from './network-submit.test-fixtures';

describe('network submit validation', () => {
  it('parses a valid ECA payload', () => {
    const payload = buildEcaApplicationJson({ role: 'ECA' });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.role).toBe('ECA');
    expect(parsed.applicant.email).toContain('@example.test');
    expect(parsed.documents).toHaveLength(4);
  });

  it('parses a valid ECE/RECE payload', () => {
    const payload = buildEcaApplicationJson({ role: 'ECE/RECE' });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.role).toBe('ECE/RECE');
    expect(parsed.roleSpecific.qualification?.status).toBe('eca_canada');
  });

  it('parses a valid Nanny payload', () => {
    const payload = buildEcaApplicationJson({ role: 'Nanny' });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.role).toBe('Nanny');
    expect(parsed.roleSpecific.training?.completed).toBe(true);
    expect(parsed.documents.some((d) => d.category === 'training_proof')).toBe(true);
  });

  it('accepts the current live website ECA legacy payload', () => {
    const payload = buildLegacyLiveWebsiteEcaPayload();
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.roleSpecific.qualification?.status).toBe('eca_canada');
    expect(() => assertRequiredDocumentsPresent(parsed)).not.toThrow();
  });

  it('accepts the current live website ECE/RECE legacy payload', () => {
    const payload = buildLegacyLiveWebsiteEcePayload();
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.roleSpecific.qualification?.status).toBe('ece_canada');
    expect(() => assertRequiredDocumentsPresent(parsed)).not.toThrow();
  });

  it('rejects invalid role', () => {
    const payload = buildEcaApplicationJson();
    const broken = { ...payload, role: 'Teacher' };
    expect(() => parseNetworkApplicationJson(JSON.stringify(broken))).toThrow(BadRequestException);
  });

  it('rejects missing consent', () => {
    const payload = buildEcaApplicationJson({ consentAccepted: false });
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
  });

  it('rejects invalid document category', () => {
    const payload = buildEcaApplicationJson();
    payload.documents[0] = {
      ...payload.documents[0]!,
      category: 'invalid_category' as never,
    };
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
  });

  it('rejects too many documents', () => {
    const payload = buildEcaApplicationJson();
    payload.documents = Array.from({ length: NETWORK_SUBMIT_MAX_FILES + 1 }, (_, i) => ({
      id: randomUUID(),
      category: 'first_aid_cpr' as const,
      originalFilename: `file-${i}.pdf`,
      contentType: 'application/pdf',
      size: 100,
    }));
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
  });

  it('rejects oversized document metadata', () => {
    const payload = buildEcaApplicationJson();
    payload.documents[0] = {
      ...payload.documents[0]!,
      size: NETWORK_SUBMIT_MAX_FILE_BYTES + 1,
    };
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
  });

  it('matches uploaded files to metadata', () => {
    const payload = buildEcaApplicationJson();
    const files = matchedFilesFromPayload(payload);
    const matched = matchSubmitFiles(payload.documents, files);
    expect(matched).toHaveLength(payload.documents.length);
  });

  it('requires role-specific documents for legacy ECA certificate statuses', () => {
    const payload = buildEcaApplicationJson({ role: 'ECA' });
    payload.documents = payload.documents.filter((d) => d.category !== 'qualification_certificate');
    expect(() => assertRequiredDocumentsPresent(payload)).toThrow(BadRequestException);
  });

  it('does not require qualification certificate for non-Canadian certificate statuses', () => {
    for (const status of ['eca_intl', 'ece_intl', 'studying', 'none'] as const) {
      const payload = buildEcaApplicationJson({ role: 'ECA' });
      payload.roleSpecific = { qualification: { status } };
      payload.documents = payload.documents.filter((d) => d.category !== 'qualification_certificate');
      expect(() => assertRequiredDocumentsPresent(payload)).not.toThrow();
    }
  });

  it('requires qualification certificate only for Canadian ECA/ECE certificate statuses', () => {
    for (const status of ['eca_canada', 'ece_canada'] as const) {
      const payload = buildEcaApplicationJson({ role: 'ECA' });
      payload.roleSpecific = { qualification: { status } };
      payload.documents = payload.documents.filter((d) => d.category !== 'qualification_certificate');
      expect(() => assertRequiredDocumentsPresent(payload)).toThrow(BadRequestException);
    }
  });

  it('compares secrets in constant time', () => {
    expect(safeCompareSecret('secret-a', 'secret-a')).toBe(true);
    expect(safeCompareSecret('secret-a', 'secret-b')).toBe(false);
  });

  it('accepts null COVID vaccination as unanswered', () => {
    const payload = buildEcaApplicationJson();
    payload.compliance.covid19 = { vaccinated: null, proofProvided: false };
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.compliance.covid19.vaccinated).toBeNull();
    expect(parsed.compliance.covid19.proofProvided).toBe(false);
    expect(mapCovidVaccinationStatus(parsed.compliance.covid19)).toBe('not_provided');
    expect(complianceToDbFields(parsed.compliance).covidVaccinationStatus).toBe('not_provided');
  });

  it('persists false COVID vaccination as not vaccinated', () => {
    const payload = buildEcaApplicationJson();
    payload.compliance.covid19 = { vaccinated: false, proofProvided: false };
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(complianceToDbFields(parsed.compliance).covidVaccinationStatus).toBe('not_vaccinated');
  });

  it('persists true COVID vaccination with proof', () => {
    const payload = buildEcaApplicationJson();
    payload.compliance.covid19 = { vaccinated: true, proofProvided: true };
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(complianceToDbFields(parsed.compliance).covidVaccinationStatus).toBe('vaccinated_with_proof');
  });

  it('rejects invalid COVID vaccination values', () => {
    const payload = buildEcaApplicationJson();
    payload.compliance.covid19 = { vaccinated: 'yes' as never, proofProvided: false };
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
  });

  it('rejects COVID proof when vaccination is unanswered', () => {
    const payload = buildEcaApplicationJson();
    payload.compliance.covid19 = { vaccinated: null, proofProvided: true };
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
  });
});

describe('network submit new qualification documents', () => {
  it('accepts ECA with no qualification uploads', () => {
    const payload = buildEcaApplicationJson({
      role: 'ECA',
      qualificationStatus: null,
      documents: buildNewShapeComplianceDocuments(),
    });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.roleSpecific.qualification).toBeUndefined();
    expect(() => assertRequiredDocumentsPresent(parsed)).not.toThrow();
  });

  it('accepts ECA with eca_diploma', () => {
    const docs = [...buildNewShapeComplianceDocuments(), documentMeta('eca_diploma', 'eca.pdf')];
    const payload = buildEcaApplicationJson({
      role: 'ECA',
      qualificationStatus: null,
      documents: docs,
    });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.documents.some((d) => d.category === 'eca_diploma')).toBe(true);
    expect(() => assertRequiredDocumentsPresent(parsed)).not.toThrow();
  });

  it('rejects ECA with ece_diploma', () => {
    const docs = [...buildNewShapeComplianceDocuments(), documentMeta('ece_diploma')];
    const payload = buildEcaApplicationJson({
      role: 'ECA',
      qualificationStatus: null,
      documents: docs,
    });
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
  });

  it('rejects ECA with rece_proof', () => {
    const docs = [...buildNewShapeComplianceDocuments(), documentMeta('rece_proof')];
    const payload = buildEcaApplicationJson({
      role: 'ECA',
      qualificationStatus: null,
      documents: docs,
    });
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
  });

  it('accepts ECE/RECE with no qualification uploads', () => {
    const payload = buildEcaApplicationJson({
      role: 'ECE/RECE',
      qualificationStatus: null,
      documents: buildNewShapeComplianceDocuments(),
    });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(() => assertRequiredDocumentsPresent(parsed)).not.toThrow();
  });

  it('accepts ECE/RECE with ece_diploma', () => {
    const docs = [...buildNewShapeComplianceDocuments(), documentMeta('ece_diploma')];
    const payload = buildEcaApplicationJson({
      role: 'ECE/RECE',
      qualificationStatus: null,
      documents: docs,
    });
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).not.toThrow();
  });

  it('accepts ECE/RECE with rece_proof', () => {
    const docs = [...buildNewShapeComplianceDocuments(), documentMeta('rece_proof')];
    const payload = buildEcaApplicationJson({
      role: 'ECE/RECE',
      qualificationStatus: null,
      documents: docs,
    });
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).not.toThrow();
  });

  it('accepts ECE/RECE with both ece_diploma and rece_proof', () => {
    const docs = [
      ...buildNewShapeComplianceDocuments(),
      documentMeta('ece_diploma'),
      documentMeta('rece_proof', 'rece.pdf'),
    ];
    const payload = buildEcaApplicationJson({
      role: 'ECE/RECE',
      qualificationStatus: null,
      documents: docs,
    });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.documents.filter((d) => d.category === 'ece_diploma' || d.category === 'rece_proof')).toHaveLength(2);
  });

  it('rejects ECE/RECE with eca_diploma', () => {
    const docs = [...buildNewShapeComplianceDocuments(), documentMeta('eca_diploma')];
    const payload = buildEcaApplicationJson({
      role: 'ECE/RECE',
      qualificationStatus: null,
      documents: docs,
    });
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
  });

  it('rejects Nanny with structured qualification categories', () => {
    for (const category of ['eca_diploma', 'ece_diploma', 'rece_proof'] as const) {
      const docs = [...buildEcaApplicationJson({ role: 'Nanny' }).documents, documentMeta(category)];
      const payload = buildEcaApplicationJson({ role: 'Nanny', documents: docs });
      expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
    }
  });
});

describe('network submit childcare experience', () => {
  it('accepts legacy payloads without experience.description', () => {
    const payload = buildLegacyLiveWebsiteEcaPayload();
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.experience.description).toBeUndefined();
  });

  it('accepts empty experience.description during transition', () => {
    const payload = buildEcaApplicationJson({ experienceDescription: '' });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.experience.description).toBeUndefined();
  });

  it('stores populated experience.description', () => {
    const payload = buildEcaApplicationJson({ experienceDescription: 'Five years in licensed daycare.' });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.experience.description).toBe('Five years in licensed daycare.');
  });

  it('accepts exactly 2000 characters', () => {
    const payload = buildEcaApplicationJson({ experienceDescription: 'a'.repeat(2000) });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.experience.description).toHaveLength(CHILDCARE_EXPERIENCE_MAX_LENGTH);
  });

  it('rejects descriptions over 2000 characters', () => {
    const payload = buildEcaApplicationJson({ experienceDescription: 'a'.repeat(2001) });
    expect(() => parseNetworkApplicationJson(JSON.stringify(payload))).toThrow(BadRequestException);
  });
});

describe('network submit file matching', () => {
  it('rejects mismatched file count', () => {
    const payload = buildEcaApplicationJson();
    expect(() => matchSubmitFiles(payload.documents, [])).toThrow(BadRequestException);
  });

  it('rejects size mismatch', () => {
    const payload = buildEcaApplicationJson();
    const files = matchedFilesFromPayload(payload);
    files[0]!.size = 999;
    expect(() => matchSubmitFiles(payload.documents, files)).toThrow(BadRequestException);
  });
});

describe('network submit buffers', () => {
  it('creates fake pdf buffers of requested size', () => {
    const buf = fakePdfBuffer('test', 256);
    expect(buf.byteLength).toBe(256);
  });
});
