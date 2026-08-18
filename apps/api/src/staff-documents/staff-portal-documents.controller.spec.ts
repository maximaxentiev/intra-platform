import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CarerPortalEnabledGuard } from '../staff-portal/carer-portal-enabled.guard';
import { isStaffDocumentReminderType } from './staff-document.constants';
import { parseRetainFileIds } from './staff-document-multipart.util';

const apiRoot = join(__dirname);

function readControllerSource() {
  return readFileSync(join(apiRoot, 'staff-portal-documents.controller.ts'), 'utf8');
}

function configService(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  } as ConfigService;
}

describe('Staff portal documents guards', () => {
  it('returns 404 when carer portal feature flag is off', () => {
    const guard = new CarerPortalEnabledGuard(configService({ CARER_PORTAL_ENABLED: false }));
    expect(() => guard.canActivate({} as never)).toThrow(NotFoundException);
  });
});

describe('retainFileIds parsing', () => {
  it('rejects duplicate ids', () => {
    expect(() => parseRetainFileIds(JSON.stringify(['a', 'a']))).toThrow(/duplicate/i);
  });

  it('accepts valid UUID arrays', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(parseRetainFileIds(JSON.stringify([id]))).toEqual([id]);
  });
});

describe('carer document reminder toggle endpoint', () => {
  it('exposes PATCH reminders route with staff session guards', () => {
    const src = readControllerSource();
    expect(src).toContain("@Patch(':documentType/reminders')");
    expect(src).toContain('setRemindersCarer');
    expect(src).toContain('@CurrentStaff()');
    expect(src).not.toContain('staffId');
  });

  it('rejects unsupported reminder document types at service layer', () => {
    expect(isStaffDocumentReminderType('vulnerable_sector_check')).toBe(true);
    expect(isStaffDocumentReminderType('first_aid_cpr')).toBe(true);
    expect(isStaffDocumentReminderType('immunizations')).toBe(false);
    expect(isStaffDocumentReminderType('covid19_vaccination')).toBe(false);
  });
});
