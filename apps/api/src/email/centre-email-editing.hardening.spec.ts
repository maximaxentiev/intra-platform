import { describe, expect, it } from 'vitest';
import {
  buildCentreEmailSecureDocMarker,
  renderCentreEmailFromEditableBody,
  validateCentreEmailSecureDocMarkers,
} from './centre-email-body.util';
import { validateCentreEmailBody } from './centre-email-custom-content.util';
import { INTRA_EMAIL_SIGN_OFF_PLAIN } from './platform-email-branding.util';
import {
  buildBatchConfirmationFinalEmailContent,
  buildBatchConfirmationFinalEmailDefaultBody,
} from '../shift-batches/shift-batch-confirmation-final-email.template';
import {
  buildBatchConfirmationUpdateEmailContent,
  buildBatchConfirmationUpdateEmailDefaultBody,
} from '../shift-batches/shift-batch-confirmation-update-email.template';
import {
  buildShiftAssignmentCentreEmailContent,
  buildShiftAssignmentCentreEmailDefaultBody,
} from '../shifts/shift-assignment-centre-email.template';

const STAFF_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_OTHER = '22222222-2222-4222-8222-222222222222';

const ASSIGNMENT_PARAMS = {
  centreName: 'Sunrise Centre',
  carerLegalName: 'Jaspreet Singh',
  assignedStaffId: STAFF_ID,
  roleNeeded: 'ECE' as const,
  shiftDate: '2026-09-05',
  startTime: '09:00:00',
  endTime: '17:00:00',
  shiftConfirmationNotes: 'Bring staff ID',
  documentShareUrl: 'https://example.test/share/abc',
};

describe('centre email editing hardening', () => {
  describe('edit all major email sections', () => {
    it('renders customized text throughout the assignment email body', () => {
      const defaultBody = buildShiftAssignmentCentreEmailDefaultBody(ASSIGNMENT_PARAMS);
      const customBody = [
        'SYNTH_GREETING staffing confirmation',
        '',
        'SYNTH_INTRO please review the assignment below.',
        '',
        'Carer: SYNTH_CARER_NAME Alpha Tester',
        'Role: SYNTH_ROLE Lead Educator',
        'Date: SYNTH_DATE Friday, 12 September 2026',
        'Time: SYNTH_TIME 10:15 AM – 6:15 PM',
        '',
        'Shift Notes:',
        'SYNTH_NOTES wear blue lanyard',
        '',
        'SYNTH_CLOSING thank you for your partnership.',
        '',
        'View documents:',
        buildCentreEmailSecureDocMarker(STAFF_ID),
      ].join('\n');

      const content = buildShiftAssignmentCentreEmailContent({
        ...ASSIGNMENT_PARAMS,
        customSubject: 'SYNTH_SUBJECT Custom confirmation',
        customBody,
      });

      expect(content.subject).toBe('SYNTH_SUBJECT Custom confirmation');
      for (const token of [
        'SYNTH_GREETING',
        'SYNTH_INTRO',
        'SYNTH_CARER_NAME',
        'SYNTH_ROLE',
        'SYNTH_DATE',
        'SYNTH_TIME',
        'SYNTH_NOTES',
        'SYNTH_CLOSING',
      ]) {
        expect(content.text).toContain(token);
        expect(content.html).toContain(token);
      }

      expect(content.text).not.toContain('Jaspreet Singh');
      expect(content.text).not.toContain('Bring staff ID');
      expect(content.text).toContain('https://example.test/share/abc');
      expect(content.text).toContain(INTRA_EMAIL_SIGN_OFF_PLAIN);
      expect(content.html).toContain('Very best,');
    });
  });

  describe('default path regression', () => {
    it('preserves canonical individual assignment email when unedited', () => {
      const baseline = buildShiftAssignmentCentreEmailContent(ASSIGNMENT_PARAMS);
      const unchanged = buildShiftAssignmentCentreEmailContent({
        ...ASSIGNMENT_PARAMS,
        customSubject: baseline.defaultSubject,
        customBody: baseline.defaultBody,
      });
      expect(unchanged.html).toBe(baseline.html);
      expect(unchanged.text).toBe(baseline.text);
      expect(unchanged.subject).toBe(baseline.subject);
    });

    it('preserves canonical batch final email when unedited', () => {
      const assignments = [
        {
          assignedStaffId: STAFF_ID,
          shiftDate: '2026-09-10',
          startTime: '08:00:00',
          endTime: '16:00:00',
          roleNeeded: 'ECE' as const,
          carerLegalName: 'Jane Smith',
          shiftConfirmationNotes: 'Room 3',
          documentShareUrl: 'https://example.test/doc',
        },
      ];
      const params = {
        centreName: 'ABC Centre',
        activeShiftCount: 1,
        assignments,
      };
      const baseline = buildBatchConfirmationFinalEmailContent(params);
      const unchanged = buildBatchConfirmationFinalEmailContent({
        ...params,
        customSubject: baseline.defaultSubject,
        customBody: baseline.defaultBody,
      });
      expect(unchanged.html).toBe(baseline.html);
      expect(unchanged.text).toBe(baseline.text);
    });

    it('preserves canonical batch update email when unedited', () => {
      const assignments = [
        {
          assignedStaffId: STAFF_ID,
          shiftDate: '2026-09-10',
          startTime: '08:00:00',
          endTime: '16:00:00',
          roleNeeded: 'ECE' as const,
          carerLegalName: 'Jane Smith',
          shiftConfirmationNotes: '',
          documentShareUrl: 'https://example.test/doc',
        },
      ];
      const params = {
        centreName: 'ABC Centre',
        highlightedChanges: ['Shift Notes updated'],
        assignments,
      };
      const baseline = buildBatchConfirmationUpdateEmailContent(params);
      const unchanged = buildBatchConfirmationUpdateEmailContent({
        ...params,
        customSubject: baseline.defaultSubject,
        customBody: baseline.defaultBody,
      });
      expect(unchanged.html).toBe(baseline.html);
      expect(unchanged.text).toBe(baseline.text);
    });
  });

  describe('secure document marker tampering', () => {
    const expected = [STAFF_ID];
    const validBody = `Intro text\n${buildCentreEmailSecureDocMarker(STAFF_ID)}\nOutro`;

    it('allows editing text around a protected block', () => {
      const edited = `Edited intro\n${buildCentreEmailSecureDocMarker(STAFF_ID)}\nEdited outro`;
      expect(() => validateCentreEmailSecureDocMarkers(edited, expected)).not.toThrow();
      const rendered = renderCentreEmailFromEditableBody({
        body: edited,
        documentLinks: new Map([
          [STAFF_ID, { url: 'https://example.test/fresh', carerLegalName: 'Jane' }],
        ]),
      });
      expect(rendered.text).toContain('Edited intro');
      expect(rendered.text).toContain('Edited outro');
    });

    it('rejects removed markers', () => {
      expect(() => validateCentreEmailSecureDocMarkers('Intro only', expected)).toThrow(
        'missing one or more secure document sections',
      );
    });

    it('rejects duplicated markers', () => {
      const duplicated = `${validBody}\n${buildCentreEmailSecureDocMarker(STAFF_ID)}`;
      expect(() => validateCentreEmailSecureDocMarkers(duplicated, expected)).toThrow();
    });

    it('rejects altered staff UUID inside a marker', () => {
      const tampered = `Intro\n${buildCentreEmailSecureDocMarker(STAFF_OTHER)}`;
      expect(() => validateCentreEmailSecureDocMarkers(tampered, expected)).toThrow(
        'invalid secure document sections',
      );
    });

    it('rejects unknown extra markers', () => {
      const extra = `${validBody}\n${buildCentreEmailSecureDocMarker(STAFF_OTHER)}`;
      expect(() => validateCentreEmailSecureDocMarkers(extra, expected)).toThrow();
    });
  });

  describe('HTML and script safety', () => {
    it('rejects unsafe markup anywhere in the full body', () => {
      const malicious = [
        'Staffing confirmation',
        '',
        'Carer: Jane Doe',
        '<img src=x onerror=alert(1)>',
        buildCentreEmailSecureDocMarker(STAFF_ID),
      ].join('\n');
      expect(() => validateCentreEmailBody(malicious)).toThrow('cannot contain HTML markup');
    });

    it('escapes malicious content after shift-detail text in rendered output', () => {
      const rendered = renderCentreEmailFromEditableBody({
        body: 'Shift details\nTime: 9:00 AM\n<script>alert(1)</script>',
        documentLinks: new Map(),
      });
      expect(rendered.html).not.toMatch(/<script/i);
      expect(rendered.html).toContain('&lt;script&gt;');
    });
  });
});
