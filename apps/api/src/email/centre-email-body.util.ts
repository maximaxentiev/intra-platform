import { BadRequestException } from '@nestjs/common';
import { CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_LABEL } from './centre-email-custom-content.util';
import { appendIntraEmailSignOffText } from './platform-email-branding.util';
import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from '../shifts/shift-assignment-notification.util';

export const CENTRE_EMAIL_SECURE_DOC_MARKER_PREFIX = '[[INTRA_SECURE_DOC:';
export const CENTRE_EMAIL_SECURE_DOC_MARKER_SUFFIX = ']]';

const SECURE_DOC_MARKER_RE =
  /\[\[INTRA_SECURE_DOC:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]/g;

export type CentreEmailBodySegment =
  | { type: 'text'; content: string }
  | { type: 'secureDocumentLink'; staffId: string };

export type CentreEmailDocumentLinkContext = {
  url: string;
  carerLegalName: string;
};

export function buildCentreEmailSecureDocMarker(staffId: string): string {
  return `${CENTRE_EMAIL_SECURE_DOC_MARKER_PREFIX}${staffId}${CENTRE_EMAIL_SECURE_DOC_MARKER_SUFFIX}`;
}

export function extractCentreEmailSecureDocStaffIds(body: string): string[] {
  return [...body.matchAll(new RegExp(SECURE_DOC_MARKER_RE.source, 'g'))].map((match) => match[1]!);
}

export function validateCentreEmailSecureDocMarkers(body: string, expectedStaffIds: string[]): void {
  const found = extractCentreEmailSecureDocStaffIds(body);
  if (found.length !== expectedStaffIds.length) {
    throw new BadRequestException(
      'Centre email draft is missing one or more secure document sections.',
    );
  }
  const expectedSorted = [...expectedStaffIds].sort();
  const foundSorted = [...found].sort();
  for (let index = 0; index < expectedSorted.length; index += 1) {
    if (expectedSorted[index] !== foundSorted[index]) {
      throw new BadRequestException('Centre email draft has invalid secure document sections.');
    }
  }
}

export function splitCentreEmailBodySegments(body: string): CentreEmailBodySegment[] {
  const segments: CentreEmailBodySegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(new RegExp(SECURE_DOC_MARKER_RE.source, 'g'))) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: 'text', content: body.slice(lastIndex, start) });
    }
    segments.push({ type: 'secureDocumentLink', staffId: match[1]! });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < body.length) {
    segments.push({ type: 'text', content: body.slice(lastIndex) });
  }
  return segments;
}

export function serializeCentreEmailBodySegments(segments: CentreEmailBodySegment[]): string {
  return segments
    .map((segment) =>
      segment.type === 'text'
        ? segment.content
        : buildCentreEmailSecureDocMarker(segment.staffId),
    )
    .join('');
}

export function renderPlainTextSegmentToHtmlRows(text: string, firstRowPaddingTop = '12px'): string {
  const trimmed = text.replace(/^\n+|\n+$/g, '');
  if (!trimmed) return '';
  const paragraphs = trimmed.split(/\n\n+/);
  return paragraphs
    .map((paragraph, index) => {
      const paddingTop = index === 0 ? firstRowPaddingTop : '16px';
      const html = escapeShiftAssignmentEmailHtml(paragraph.trim()).replace(/\n/g, '<br/>');
      return `<tr><td style="padding-top:${paddingTop};font-size:15px;line-height:1.6;color:#333;">${html}</td></tr>`;
    })
    .join('');
}

export function renderSecureDocumentLinkHtmlRows(params: {
  staffId: string;
  link: CentreEmailDocumentLinkContext | undefined;
  previewMode: boolean;
}): string {
  const carerName = escapeShiftAssignmentEmailHtml(params.link?.carerLegalName ?? 'Carer');
  const previewMode = params.previewMode || !params.link?.url;
  const href = previewMode
    ? 'https://intra.invalid/preview/document-link'
    : escapeShiftAssignmentEmailHtml(params.link!.url);
  const buttonLabel = previewMode
    ? 'View approved documents (secure link included when sent)'
    : `View ${carerName}&apos;s current approved documents`;
  const previewNote = previewMode
    ? `<tr><td style="padding-top:8px;font-size:13px;line-height:1.5;color:#666;text-align:center;">${escapeShiftAssignmentEmailHtml(CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_LABEL)}</td></tr>`
    : '';

  return `<tr><td style="padding-top:24px;" align="center">
          <a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">${buttonLabel}</a>
        </td></tr>${previewNote}`;
}

export function renderCentreEmailFromEditableBody(params: {
  body: string;
  documentLinks: Map<string, CentreEmailDocumentLinkContext>;
  previewMode?: boolean;
}): { html: string; text: string } {
  const previewMode = params.previewMode === true;
  const segments = splitCentreEmailBodySegments(params.body);
  let htmlRows = '';
  const textParts: string[] = [];
  let firstText = true;

  for (const segment of segments) {
    if (segment.type === 'text') {
      htmlRows += renderPlainTextSegmentToHtmlRows(segment.content, firstText ? '0px' : '16px');
      textParts.push(segment.content);
      if (segment.content.trim()) firstText = false;
      continue;
    }

    const link = params.documentLinks.get(segment.staffId);
    htmlRows += renderSecureDocumentLinkHtmlRows({
      staffId: segment.staffId,
      link,
      previewMode,
    });
    textParts.push(
      previewMode
        ? CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_LABEL
        : link?.url ?? CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_LABEL,
    );
    firstText = false;
  }

  const textBody = textParts.join('').replace(/\n{3,}/g, '\n\n').trim();
  return {
    html: wrapShiftAssignmentEmailHtml(htmlRows),
    text: appendIntraEmailSignOffText(textBody),
  };
}

export function centreEmailBodyContainsUnsafeMarkup(body: string): boolean {
  return /<\s*\/?\s*(script|iframe|object|embed|link|meta|style|img|svg|form|input|button|textarea|select)\b/i.test(
    body,
  );
}
