import { vi } from 'vitest';
import type { ShiftUpdateCommunicationService } from './shift-update-communication.service';

export function createMockShiftUpdateCommunicationService() {
  return {
    sendCommunications: vi.fn().mockResolvedValue({ centre: null, carer: null }),
  } as unknown as ShiftUpdateCommunicationService;
}
