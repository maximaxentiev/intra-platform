import { describe, expect, it } from 'vitest';
import { emailHtmlHasSingleIntraBranding, wrapIntraEmailHtml } from './platform-email-branding.util';
import { buildBatchConfirmationFinalEmailContent } from '../shift-batches/shift-batch-confirmation-final-email.template';
import { buildBatchProgress70EmailContent } from '../shift-batches/shift-batch-progress-email.template';
import { buildShiftAssignmentCarerEmailContent } from '../shifts/shift-assignment-carer-email.template';
import { buildShiftAssignmentCentreEmailContent } from '../shifts/shift-assignment-centre-email.template';
import { buildStaffInviteEmailContent } from '../staff-portal/staff-invite-email.template';

const LOGO = 'https://platform.intra.ca/intra-logo-purple.png';
const PROD_ENV = { NODE_ENV: 'production', APP_PUBLIC_URL: 'https://platform.intra.ca' } as const;
const PLATFORM_ENV = { APP_PUBLIC_URL: 'https://platform.example', NODE_ENV: 'test' } as const;

/** Representative sample across all outbound HTML email categories. */
export const OUTBOUND_EMAIL_TEMPLATE_INVENTORY = [
  'shift-assignment-carer',
  'shift-assignment-centre',
  'shift-assignment-resend (same builders)',
  'shift-update-carer',
  'shift-update-centre',
  'shift-update-unassign-carer',
  'shift-update-unassign-centre',
  'shift-manual-unassign-carer',
  'shift-manual-unassign-centre',
  'shift-cancellation-carer',
  'shift-cancellation-centre',
  'shift-reminder-carer',
  'batch-progress-70',
  'batch-final-confirmation',
  'document-expiry-carer',
  'staff-invite',
  'staff-password-reset',
  'staff-account-confirmation',
] as const;

function sampleBrandedHtmlTemplates() {
  return [
    {
      name: 'assignment-carer',
      html: buildShiftAssignmentCarerEmailContent({
        centreName: 'ABC Child Care Centre',
        centreAddress: '123 Main Street',
        centreCity: 'Toronto',
        centreNotes: 'Park in the rear lot.',
        shiftConfirmationNotes: 'Bring indoor shoes.',
        roleNeeded: 'ECE',
        shiftDate: '2026-08-25',
        startTime: '08:30:00',
        endTime: '16:30:00',
        shiftId: 'shift-1',
        includePortalLink: true,
        platformEnv: PLATFORM_ENV,
      }).html,
    },
    {
      name: 'assignment-centre',
      html: buildShiftAssignmentCentreEmailContent({
        centreName: 'ABC Child Care Centre',
        carerLegalName: 'Jane Doe',
        roleNeeded: 'ECE',
        shiftDate: '2026-08-25',
        startTime: '08:30:00',
        endTime: '16:30:00',
        shiftConfirmationNotes: '',
        documentShareUrl: 'https://platform.example/documents/jane-doe#token',
      }).html,
    },
    {
      name: 'batch-progress-70',
      html: buildBatchProgress70EmailContent({
        centreName: 'Centre',
        fulfilledCount: 7,
        activeTotal: 10,
      }).html,
    },
    {
      name: 'batch-final-confirmation',
      html: buildBatchConfirmationFinalEmailContent({
        centreName: 'Centre',
        activeShiftCount: 1,
        assignments: [
          {
            shiftDate: '2026-09-01',
            startTime: '09:00:00',
            endTime: '17:00:00',
            roleNeeded: 'ECE',
            carerLegalName: 'Jane',
            shiftConfirmationNotes: '',
            documentShareUrl: 'https://example.test/doc',
          },
        ],
      }).html,
    },
    {
      name: 'staff-invite',
      html: buildStaffInviteEmailContent({
        legalFirstName: 'Jane',
        inviteToken: 'token',
        expiresAt: new Date('2026-12-01T00:00:00Z'),
        platformEnv: PROD_ENV,
      }).html,
    },
  ];
}

describe('outbound email branding inventory', () => {
  it('documents all active outbound email categories', () => {
    expect(OUTBOUND_EMAIL_TEMPLATE_INVENTORY.length).toBeGreaterThanOrEqual(17);
  });

  it('each sampled HTML template has exactly one logo and sign-off', () => {
    for (const entry of sampleBrandedHtmlTemplates()) {
      expect(emailHtmlHasSingleIntraBranding(entry.html), entry.name).toBe(true);
      expect(entry.html).toContain('Very best,');
      expect(entry.html).toContain('The Intra team');
      expect(entry.html).toContain('alt="Intra"');
    }
  });

  it('shared wrapper prevents duplicate branding layers', () => {
    const once = wrapIntraEmailHtml('<tr><td>Body</td></tr>', LOGO);
    expect(emailHtmlHasSingleIntraBranding(once)).toBe(true);
    expect(wrapIntraEmailHtml(once, LOGO)).toBe(once);
  });
});
