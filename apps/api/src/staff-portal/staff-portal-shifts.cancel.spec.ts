import { describe, expect, it } from 'vitest';
import { StaffPortalShiftsController } from './staff-portal-shifts.controller';
import { StaffPortalShiftsService } from './staff-portal-shifts.service';

describe('StaffPortalShiftsController carer cancellation', () => {
  it('does not expose a carer shift cancellation endpoint', () => {
    const methodNames = Object.getOwnPropertyNames(StaffPortalShiftsController.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(methodNames).not.toContain('cancelShift');
  });

  it('does not implement cancelShift on the service', () => {
    expect(StaffPortalShiftsService.prototype.cancelShift).toBeUndefined();
  });
});
