import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  NETWORK_SUBMIT_MAX_FILES,
  NETWORK_SUBMIT_MAX_FILE_BYTES,
} from './network-submit.constants';
import { safeCompareSecret } from './network-submit.util';
import {
  assertRequiredDocumentsPresent,
  matchSubmitFiles,
  parseNetworkApplicationJson,
} from './network-submit.validation';
import { buildEcaApplicationJson, fakePdfBuffer, matchedFilesFromPayload } from './network-submit.test-fixtures';

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
    expect(parsed.roleSpecific.qualification?.status).toBe('registered');
  });

  it('parses a valid Nanny payload', () => {
    const payload = buildEcaApplicationJson({ role: 'Nanny' });
    const parsed = parseNetworkApplicationJson(JSON.stringify(payload));
    expect(parsed.role).toBe('Nanny');
    expect(parsed.roleSpecific.training?.completed).toBe(true);
    expect(parsed.documents.some((d) => d.category === 'training_proof')).toBe(true);
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

  it('requires role-specific documents', () => {
    const payload = buildEcaApplicationJson({ role: 'ECA' });
    payload.documents = payload.documents.filter((d) => d.category !== 'qualification_certificate');
    expect(() => assertRequiredDocumentsPresent(payload)).toThrow(BadRequestException);
  });

  it('compares secrets in constant time', () => {
    expect(safeCompareSecret('secret-a', 'secret-a')).toBe(true);
    expect(safeCompareSecret('secret-a', 'secret-b')).toBe(false);
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
