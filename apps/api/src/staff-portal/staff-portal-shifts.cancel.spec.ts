import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { StaffPortalShiftsController } from './staff-portal-shifts.controller';
import { StaffPortalShiftsService } from './staff-portal-shifts.service';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(rel: string) {
  return readFileSync(join(apiRoot, rel), 'utf8');
}

const READ_ONLY_SHIFT_METHODS = ['listUpcoming', 'listHistory', 'summary', 'getDetail'] as const;

describe('StaffPortalShiftsController carer cancellation', () => {
  it('does not expose a carer shift cancellation endpoint', () => {
    const methodNames = Object.getOwnPropertyNames(StaffPortalShiftsController.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(methodNames).not.toContain('cancelShift');
    expect(methodNames).toEqual(expect.arrayContaining([...READ_ONLY_SHIFT_METHODS]));
  });

  it('does not implement cancelShift on the service', () => {
    expect(StaffPortalShiftsService.prototype.cancelShift).toBeUndefined();
  });

  it('does not register POST /staff-portal/shifts/:id/cancel in controller source', () => {
    const controller = readSrc('staff-portal/staff-portal-shifts.controller.ts');
    expect(controller).not.toContain("@Post(':id/cancel')");
    expect(controller).not.toContain('cancelShift');
    expect(controller).not.toContain('CancelStaffPortalShiftDto');
    expect(controller).not.toMatch(/\bPost\s*\(/);
  });

  it('does not define carer cancellation DTOs', () => {
    const dto = readSrc('staff-portal/dto/staff-portal-shifts.dto.ts');
    expect(dto).not.toContain('CancelStaffPortalShiftDto');
    expect(dto).not.toMatch(/class\s+\w*Cancel/);
  });

  it('keeps staff portal shifts service read-only for carers', () => {
    const service = readSrc('staff-portal/staff-portal-shifts.service.ts');
    for (const method of READ_ONLY_SHIFT_METHODS) {
      expect(service).toContain(`async ${method}(`);
    }
    expect(service).not.toContain('cancelShift');
    expect(service).not.toContain('.update(shifts');
    expect(service).not.toMatch(/status:\s*['"]cancelled['"]/);
  });
});
