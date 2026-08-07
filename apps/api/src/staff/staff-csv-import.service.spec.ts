import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { staff, staffAccounts } from '../db/schema';
import { STAFF_PORTAL_AUDIT_EVENTS } from '../staff-portal/staff-portal-audit.service';
import { StaffCsvImportService } from './staff-csv-import.service';

function file(content: string, name = 'staff.csv'): Express.Multer.File {
  const buffer = Buffer.from(content, 'utf8');
  return {
    fieldname: 'file',
    originalname: name,
    encoding: 'utf8',
    mimetype: 'text/csv',
    size: buffer.length,
    buffer,
    stream: null as never,
    destination: '',
    filename: name,
    path: '',
  };
}

const HEADER =
  'Display Name,Legal First Name,Legal Last Name,Email Address,Phone Number,Home Address,City';

describe('StaffCsvImportService', () => {
  let service: StaffCsvImportService;
  let staffCreate: ReturnType<typeof vi.fn>;
  let inviteSend: ReturnType<typeof vi.fn>;
  let auditRecord: ReturnType<typeof vi.fn>;
  let dbSelectRows: { staff: { email: string }[]; accounts: { email: string }[] };

  beforeEach(() => {
    staffCreate = vi.fn();
    inviteSend = vi.fn();
    auditRecord = vi.fn();
    dbSelectRows = { staff: [], accounts: [] };

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: unknown) => ({
          where: vi.fn().mockResolvedValue([]),
          then: undefined,
          // sync return for from().without where
        })),
      }),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockImplementation((table: unknown) => {
        if (table === staffAccounts) return Promise.resolve(dbSelectRows.accounts);
        if (table === staff) return Promise.resolve(dbSelectRows.staff);
        return Promise.resolve([]);
      }),
    });

    service = new StaffCsvImportService(
      db as never,
      { createManual: staffCreate } as never,
      { sendInvitation: inviteSend } as never,
      { record: auditRecord } as never,
    );
  });

  it('preview performs no staff creation', async () => {
    const content = `${HEADER}\nAlex C,Alex,Carer,new@example.test,555,1 Main,Toronto`;
    await service.previewFromUpload(file(content));
    expect(staffCreate).not.toHaveBeenCalled();
    expect(inviteSend).not.toHaveBeenCalled();
  });

  it('rejects oversize uploads', () => {
    const big = file('x'.repeat(600 * 1024));
    expect(() => service['readUpload'](big)).toThrow(PayloadTooLargeException);
  });

  it('imports valid rows only', async () => {
    staffCreate.mockResolvedValue({ id: 'staff-1', email: 'new@example.test' });
    const content = `${HEADER}\nAlex C,Alex,Carer,new@example.test,555,1 Main,Toronto\nBad,,X,bad,555,1 Main,`;
    const result = await service.executeImport(file(content), 'ops-1', false);
    expect(staffCreate).toHaveBeenCalledTimes(1);
    expect(result.summary.staffCreated).toBe(1);
    expect(result.summary.skipped).toBeGreaterThan(0);
  });

  it('retries without duplicating staff when email already exists at import time', async () => {
    dbSelectRows.staff = [{ email: 'taken@example.test' }];
    const content = `${HEADER}\nAlex C,Alex,Carer,taken@example.test,555,1 Main,Toronto`;
    const result = await service.executeImport(file(content), 'ops-1', false);
    expect(staffCreate).not.toHaveBeenCalled();
    expect(result.summary.duplicates).toBe(1);
  });

  it('reports invitation email failure without rolling back staff', async () => {
    staffCreate.mockResolvedValue({ id: 'staff-1', email: 'new@example.test' });
    inviteSend.mockResolvedValue({
      emailSent: false,
      ok: false,
      message: 'SMTP failed',
    });
    const content = `${HEADER}\nAlex C,Alex,Carer,new@example.test,555,1 Main,Toronto`;
    const result = await service.executeImport(file(content), 'ops-1', true);
    expect(result.summary.staffCreated).toBe(1);
    expect(result.summary.invitationEmailFailures).toBe(1);
    expect(result.rows[0]!.outcome).toBe('invitation_failed');
  });

  it('does not include raw tokens in import results', async () => {
    staffCreate.mockResolvedValue({ id: 'staff-1', email: 'new@example.test' });
    inviteSend.mockResolvedValue({ emailSent: true, ok: true });
    const content = `${HEADER}\nAlex C,Alex,Carer,new@example.test,555,1 Main,Toronto`;
    const result = await service.executeImport(file(content), 'ops-1', true);
    const blob = JSON.stringify(result);
    expect(blob.toLowerCase()).not.toContain('invite_token');
    expect(blob).not.toContain('invite-token');
  });

  it('records bulk import audit without sensitive fields', async () => {
    staffCreate.mockResolvedValue({ id: 'staff-1', email: 'new@example.test' });
    const content = `${HEADER}\nAlex C,Alex,Carer,new@example.test,555,1 Main,Toronto`;
    await service.executeImport(file(content), 'ops-1', false);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: STAFF_PORTAL_AUDIT_EVENTS.staffBulkImportCompleted,
      }),
    );
    const detail = JSON.stringify(auditRecord.mock.calls[0]![0]);
    expect(detail.toLowerCase()).not.toContain('token');
  });
});
