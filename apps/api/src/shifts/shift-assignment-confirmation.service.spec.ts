import { ConfigService } from '@nestjs/config';
import { asc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { centreContacts, centres, shifts, staff, staffAccounts } from '../db/schema';
import { EmailService } from '../email/email.service';
import { RecordingEmailTransport } from '../email/email.transport';
import { StaffDocumentShareLifecycleService } from '../staff-documents/staff-document-share-lifecycle.service';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftAssignmentNotificationsService } from './shift-assignment-notifications.service';
import { ShiftCommunicationPolicyService } from './shift-communication-policy.service';

function configService() {
  return {
    get: (key: string) => {
      if (key === 'APP_PUBLIC_URL') return 'https://platform.example';
      if (key === 'EMAIL_FROM') return 'Intra Platform <noreply@intra.ca>';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    },
  } as ConfigService;
}

describe('ShiftAssignmentConfirmationService', () => {
  let email: EmailService;
  let transport: RecordingEmailTransport;
  let notificationRecords: unknown[];
  let shareLifecycle: StaffDocumentShareLifecycleService;
  let service: ShiftAssignmentConfirmationService;

  beforeEach(() => {
    transport = new RecordingEmailTransport();
    email = new EmailService(configService());
    email.useTransport(transport);
    notificationRecords = [];

    const contextRow = {
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      shiftDate: '2026-08-25',
      startTime: '08:30:00',
      endTime: '16:30:00',
      roleNeeded: 'ECE',
      centreId: 'centre-1',
      centreName: 'ABC Centre',
      centreAddress: '123 Main Street',
      centreCity: 'Toronto',
      centreNotes: 'Use rear entrance.',
      shiftConfirmationNotes: '',
      legalName: 'Jane Legal',
      legalFirstName: 'Jaspreet',
      legalLastName: 'Singh',
      displayName: 'Jane Doe',
      useDisplayName: true,
      staffEmail: 'carer@example.test',
      accountEmail: 'carer@example.test',
      accountStatus: 'active' as const,
      onboardingCompletedAt: new Date(),
      passwordHash: 'hash',
    };

    const db = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table: unknown) => {
          if (table === centreContacts) {
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ email: 'centre@example.test' }]),
                }),
              }),
            };
          }
          return {
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue([contextRow]),
                }),
              }),
            }),
          };
        }),
      })),
    };

    shareLifecycle = {
      buildActiveStaffDocumentShareUrl: vi
        .fn()
        .mockResolvedValue('https://platform.example/documents/jane#token'),
      generateShareLink: vi.fn(),
    } as unknown as StaffDocumentShareLifecycleService;

    const notifications = {
      record: vi.fn().mockImplementation(async (row: unknown) => {
        notificationRecords.push(row);
        return row;
      }),
    } as unknown as ShiftAssignmentNotificationsService;

    const communicationPolicy = {
      resolveForShift: vi.fn().mockResolvedValue({
        batchId: null,
        batchRequestCompleted: false,
        centreCommunicationDeferred: false,
        centreDeferReason: null,
      }),
    } as unknown as ShiftCommunicationPolicyService;

    service = new ShiftAssignmentConfirmationService(
      db as never,
      email,
      configService(),
      notifications,
      shareLifecycle,
      communicationPolicy,
    );
  });

  it('sends centre and carer confirmations and persists sent records', async () => {
    const result = await service.sendAssignmentConfirmations({
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      trigger: 'assign',
    });

    expect(result.centre.sent).toBe(true);
    expect(result.carer.sent).toBe(true);
    expect(transport.sent).toHaveLength(2);
    expect(transport.sent[0]?.to).toBe('centre@example.test');
    expect(transport.sent[1]?.to).toBe('carer@example.test');
    expect(notificationRecords).toHaveLength(2);
    const centreEmail = transport.sent.find((m) => m.to === 'centre@example.test');
    expect(centreEmail?.text).toContain('Jaspreet Singh');
    expect(centreEmail?.text).not.toContain('Jane Doe');
  });

  it('skips centre email when document share is unavailable but still attempts carer email', async () => {
    vi.mocked(shareLifecycle.buildActiveStaffDocumentShareUrl).mockResolvedValue(null);
    vi.mocked(shareLifecycle.generateShareLink).mockRejectedValue(new Error('cannot generate'));

    const result = await service.sendAssignmentConfirmations({
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      trigger: 'assign',
    });

    expect(result.centre.skippedReason).toBe('document_share_unavailable');
    expect(result.carer.sent).toBe(true);
    expect(transport.sent).toHaveLength(1);
  });

  it('resolveRecipientAvailability marks centre unavailable when document share is unavailable', async () => {
    vi.mocked(shareLifecycle.buildActiveStaffDocumentShareUrl).mockResolvedValue(null);
    vi.mocked(shareLifecycle.generateShareLink).mockRejectedValue(new Error('cannot generate'));

    const availability = await service.resolveRecipientAvailability({
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
    });

    expect(availability.centre.available).toBe(false);
    expect(availability.centre.reason).toContain('document share');
    expect(availability.carer.available).toBe(true);
  });

  it('defers centre confirmation for open batch child without attempting centre email', async () => {
    const communicationPolicy = {
      resolveForShift: vi.fn().mockResolvedValue({
        batchId: 'batch-1',
        batchRequestCompleted: false,
        centreCommunicationDeferred: true,
        centreDeferReason: 'deferred_batch_confirmation',
      }),
    } as unknown as ShiftCommunicationPolicyService;

    service = new ShiftAssignmentConfirmationService(
      {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table: unknown) => {
            if (table === centreContacts) {
              return {
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([{ email: 'centre@example.test' }]),
                  }),
                }),
              };
            }
            return {
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  leftJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                      {
                        shiftId: 'shift-1',
                        assignedStaffId: 'staff-1',
                        shiftDate: '2026-08-25',
                        startTime: '08:30:00',
                        endTime: '16:30:00',
                        roleNeeded: 'ECE',
                        centreId: 'centre-1',
                        centreName: 'ABC Centre',
                        centreAddress: '123 Main Street',
                        centreCity: 'Toronto',
                        centreNotes: '',
                        shiftConfirmationNotes: '',
                        legalName: 'Jane Legal',
                        legalFirstName: 'Jaspreet',
                        legalLastName: 'Singh',
                        displayName: 'Jane Doe',
                        useDisplayName: true,
                        staffEmail: 'carer@example.test',
                        accountEmail: 'carer@example.test',
                        accountStatus: 'active',
                        onboardingCompletedAt: new Date(),
                        passwordHash: 'hash',
                      },
                    ]),
                  }),
                }),
              }),
            };
          }),
        })),
      } as never,
      email,
      configService(),
      {
        record: vi.fn(),
      } as unknown as ShiftAssignmentNotificationsService,
      shareLifecycle,
      communicationPolicy,
    );

    const result = await service.sendAssignmentConfirmations({
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      trigger: 'assign',
    });

    expect(result.centre.deferred).toBe(true);
    expect(result.centre.skippedReason).toBe('deferred_batch_confirmation');
    expect(result.centre.attempted).toBe(false);
    expect(result.carer.sent).toBe(true);
    expect(transport.sent.filter((m) => m.to === 'centre@example.test')).toHaveLength(0);
  });
});
