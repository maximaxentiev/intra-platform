import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(apiRoot, rel), 'utf8');

describe('Shifts feed Phase B2 architecture', () => {
  it('exposes GET /shifts/feed before parameterized shift routes', () => {
    const controller = read('shifts/shifts.controller.ts');
    expect(controller).toContain("@Get('feed')");
    expect(controller.indexOf("@Get('feed')")).toBeLessThan(controller.indexOf("@Get(':id')"));
  });

  it('keeps legacy GET /shifts list endpoint intact', () => {
    const controller = read('shifts/shifts.controller.ts');
    expect(controller).toContain('@Get()');
    expect(controller).toContain('list(@Query() q: ListShiftsQuery)');
  });

  it('builds feed keys without N+1 hydration loops', () => {
    const service = read('shifts/shifts-feed.service.ts');
    expect(service).toContain('Promise.all');
    expect(service).toContain('inArray(shifts.id, shiftIds)');
    expect(service).toContain('inArray(shifts.batchId, batchIds)');
    expect(service).not.toMatch(/for \(const batchId of batchIds\)[\s\S]*await this\.db\.select/);
  });

  it('excludes batch children from individual feed items', () => {
    const service = read('shifts/shifts-feed.service.ts');
    expect(service).toContain('isNull(shifts.batchId)');
  });

  it('does not wire batch communication services into the feed', () => {
    const service = read('shifts/shifts-feed.service.ts');
    expect(service).not.toContain('ShiftAssignmentConfirmationService');
    expect(service).not.toContain('ShiftMatchingService');
  });
});
