import { vi } from 'vitest';
import type { ShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication.service';

export function createMockShiftManualUnassignCommunicationService() {
  return {
    sendCommunications: vi.fn().mockResolvedValue({ centre: null, carer: null }),
  } as unknown as ShiftManualUnassignCommunicationService;
}
