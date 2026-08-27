import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailService } from '../email/email.service';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ShiftUpdateCommunicationService } from './shift-update-communication.service';
import type { ShiftCommunicationChange } from './shift-update-changes.util';

const changes: ShiftCommunicationChange[] = [
  {
    field: 'date',
    label: 'Date',
    beforeDisplay: 'Friday, August 28, 2026',
    afterDisplay: 'Saturday, August 29, 2026',
    beforeValue: '2026-08-28',
    afterValue: '2026-08-29',
  },
];

function mockDb() {
  const centreContacts = [{ email: 'centre@example.test' }];
  const centreRows = [{ name: 'Sunshine Centre' }];
  const staffRows = [
    {
      legalName: 'Jane Doe',
      legalFirstName: 'Jane',
      legalLastName: 'Doe',
      email: 'carer@example.test',
      accountEmail: 'carer@example.test',
    },
  ];

  function chain(resolved: unknown) {
    const c: Record<string, unknown> = {};
    c.from = vi.fn().mockReturnValue(c);
    c.where = vi.fn().mockReturnValue(c);
    c.orderBy = vi.fn().mockReturnValue(c);
    c.limit = vi.fn().mockReturnValue(c);
    c.leftJoin = vi.fn().mockReturnValue(c);
    c.then = (resolve: (value: unknown) => void) => resolve(resolved);
    return c;
  }

  const responses = [centreRows, staffRows, centreContacts];
  let index = 0;

  return {
    select: vi.fn().mockImplementation(() => chain(responses[index++] ?? [])),
    reset: () => {
      index = 0;
    },
  } as never;
}

function bothRecipientsSelections() {
  return {
    centre: { recipientEmail: '', include: ['date'] as const },
    carer: { recipientEmail: '', include: ['date'] as const },
  };
}

describe('ShiftUpdateCommunicationService audit metadata', () => {
  let email: EmailService;
  let values: ReturnType<typeof vi.fn>;
  let service: ShiftUpdateCommunicationService;

  beforeEach(() => {
    email = {
      isConfigured: vi.fn().mockReturnValue(true),
      send: vi.fn().mockResolvedValue({ providerId: 'resend-msg-123' }),
    } as unknown as EmailService;

    values = vi.fn().mockResolvedValue(undefined);
    const platformAudit = new PlatformAuditService({
      insert: vi.fn().mockReturnValue({ values }),
    } as never);

    service = new ShiftUpdateCommunicationService(mockDb(), email, platformAudit);
  });

  it('records centre communication audit with deliveryMessageId', async () => {
    const result = await service.sendCommunications({
      shiftId: 'shift-1',
      centreId: 'centre-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      changes,
      selections: {
        centre: { recipientEmail: '', include: ['date'] },
      },
    });

    expect(result.centre).toEqual({ attempted: true, sent: true });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationSent,
        metadata: expect.objectContaining({
          recipientType: 'centre',
          recipientEmail: 'centre@example.test',
          includedChanges: ['date'],
          deliveryMessageId: 'resend-msg-123',
        }),
      }),
    );
  });

  it('records carer communication audit with deliveryMessageId', async () => {
    const carerValues = vi.fn().mockResolvedValue(undefined);
    const carerService = new ShiftUpdateCommunicationService(
      mockDb(),
      email,
      new PlatformAuditService({
        insert: vi.fn().mockReturnValue({ values: carerValues }),
      } as never),
    );

    const result = await carerService.sendCommunications({
      shiftId: 'shift-1',
      centreId: 'centre-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      changes,
      selections: {
        carer: { recipientEmail: '', include: ['date'] },
      },
    });

    expect(result.carer).toEqual({ attempted: true, sent: true });
    expect(carerValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationSent,
        metadata: expect.objectContaining({
          recipientType: 'carer',
          deliveryMessageId: 'resend-msg-123',
        }),
      }),
    );
  });

  it('records failed delivery audit without deliveryMessageId', async () => {
    vi.mocked(email.send).mockRejectedValue(new Error('delivery failed'));

    const failedValues = vi.fn().mockResolvedValue(undefined);
    const failedService = new ShiftUpdateCommunicationService(
      mockDb(),
      email,
      new PlatformAuditService({
        insert: vi.fn().mockReturnValue({ values: failedValues }),
      } as never),
    );

    const result = await failedService.sendCommunications({
      shiftId: 'shift-1',
      centreId: 'centre-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      changes,
      selections: {
        centre: { recipientEmail: '', include: ['date'] },
      },
    });

    expect(result.centre).toEqual({ attempted: true, sent: false });
    expect(failedValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationFailed,
        metadata: expect.objectContaining({
          recipientType: 'centre',
          includedChanges: ['date'],
          failureCode: 'send_failed',
        }),
      }),
    );
    const metadata = failedValues.mock.calls[0]?.[0]?.metadata as Record<string, unknown>;
    expect(metadata).not.toHaveProperty('deliveryMessageId');
  });

  it('delivers and audits both centre and carer when both are requested', async () => {
    vi.mocked(email.send)
      .mockResolvedValueOnce({ providerId: 'centre-msg-1' })
      .mockResolvedValueOnce({ providerId: 'carer-msg-1' });

    const result = await service.sendCommunications({
      shiftId: 'shift-1',
      centreId: 'centre-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      changes,
      selections: bothRecipientsSelections(),
    });

    expect(email.send).toHaveBeenCalledTimes(2);
    expect(result.centre).toEqual({ attempted: true, sent: true });
    expect(result.carer).toEqual({ attempted: true, sent: true });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationSent,
        metadata: expect.objectContaining({
          recipientType: 'centre',
          deliveryMessageId: 'centre-msg-1',
        }),
      }),
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationSent,
        metadata: expect.objectContaining({
          recipientType: 'carer',
          deliveryMessageId: 'carer-msg-1',
        }),
      }),
    );
  });

  it('still sends carer email when centre audit logging fails after centre delivery', async () => {
    vi.mocked(email.send)
      .mockResolvedValueOnce({ providerId: 'centre-msg-1' })
      .mockResolvedValueOnce({ providerId: 'carer-msg-1' });

    const auditInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    const platformAudit = new PlatformAuditService({ insert: auditInsert } as never);
    vi.spyOn(platformAudit, 'record').mockImplementation(async (params) => {
      if (
        params.action === PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationSent &&
        params.metadata?.recipientType === 'centre'
      ) {
        throw new BadRequestException('Unsupported audit metadata key "providerId".');
      }
    });

    const isolatedService = new ShiftUpdateCommunicationService(mockDb(), email, platformAudit);

    const result = await isolatedService.sendCommunications({
      shiftId: 'shift-1',
      centreId: 'centre-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      changes,
      selections: bothRecipientsSelections(),
    });

    expect(email.send).toHaveBeenCalledTimes(2);
    expect(result.centre).toEqual({ attempted: true, sent: true });
    expect(result.carer).toEqual({ attempted: true, sent: true });
    expect(platformAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationFailed,
        metadata: expect.objectContaining({
          recipientType: 'centre',
          failureCode: 'audit_record_failed',
          deliveryMessageId: 'centre-msg-1',
        }),
      }),
    );
    expect(platformAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationSent,
        metadata: expect.objectContaining({
          recipientType: 'carer',
          deliveryMessageId: 'carer-msg-1',
        }),
      }),
    );
  });

  it('still returns centre success when carer processing fails after centre completes', async () => {
    vi.mocked(email.send)
      .mockResolvedValueOnce({ providerId: 'centre-msg-1' })
      .mockRejectedValueOnce(new Error('carer delivery failed'));

    const result = await service.sendCommunications({
      shiftId: 'shift-1',
      centreId: 'centre-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      changes,
      selections: bothRecipientsSelections(),
    });

    expect(result.centre).toEqual({ attempted: true, sent: true });
    expect(result.carer).toEqual({ attempted: true, sent: false });
  });
});
