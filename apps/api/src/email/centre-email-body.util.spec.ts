import { describe, expect, it } from 'vitest';
import {
  buildCentreEmailSecureDocMarker,
  centreEmailBodyContainsUnsafeMarkup,
  extractCentreEmailSecureDocStaffIds,
  renderCentreEmailFromEditableBody,
  splitCentreEmailBodySegments,
  validateCentreEmailSecureDocMarkers,
} from './centre-email-body.util';
import { validateCentreEmailBody } from './centre-email-custom-content.util';

const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';

describe('centre-email-body.util', () => {
  it('round-trips secure document markers through segments', () => {
    const body = `Hello\n\nDocuments:\n${buildCentreEmailSecureDocMarker(STAFF_A)}`;
    const segments = splitCentreEmailBodySegments(body);
    expect(segments).toEqual([
      { type: 'text', content: 'Hello\n\nDocuments:\n' },
      { type: 'secureDocumentLink', staffId: STAFF_A },
    ]);
    expect(extractCentreEmailSecureDocStaffIds(body)).toEqual([STAFF_A]);
  });

  it('rejects tampered secure document marker sets', () => {
    const body = `Intro\n${buildCentreEmailSecureDocMarker(STAFF_B)}`;
    expect(() => validateCentreEmailSecureDocMarkers(body, [STAFF_A])).toThrow(
      'invalid secure document sections',
    );
  });

  it('escapes unsafe markup in rendered editable body', () => {
    const rendered = renderCentreEmailFromEditableBody({
      body: '<script>alert(1)</script>\nHello',
      documentLinks: new Map(),
    });
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.text).toContain('<script>alert(1)</script>');
  });

  it('injects fresh document links at render time', () => {
    const body = `Staff confirmed\n${buildCentreEmailSecureDocMarker(STAFF_A)}`;
    const rendered = renderCentreEmailFromEditableBody({
      body,
      documentLinks: new Map([
        [STAFF_A, { url: 'https://platform.example/documents/token', carerLegalName: 'Jane Doe' }],
      ]),
    });
    expect(rendered.html).toContain('https://platform.example/documents/token');
    expect(rendered.text).toContain('https://platform.example/documents/token');
  });

  it('blocks HTML tags in body validation', () => {
    expect(() => validateCentreEmailBody('<img src=x onerror=alert(1)>')).toThrow(
      'cannot contain HTML markup',
    );
    expect(centreEmailBodyContainsUnsafeMarkup('<script>x</script>')).toBe(true);
  });
});
