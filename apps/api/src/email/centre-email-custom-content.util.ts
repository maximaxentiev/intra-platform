import { BadRequestException } from '@nestjs/common';
import { escapeShiftAssignmentEmailHtml } from '../shifts/shift-assignment-notification.util';

export const CENTRE_EMAIL_CUSTOM_SUBJECT_MAX = 200;
export const CENTRE_EMAIL_CUSTOM_BODY_MAX = 25_000;

export const CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_LABEL =
  'Secure document link will be included when this email is sent.';

/** Non-routable placeholder used only in Ops preview HTML. */
export const CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_HREF = 'https://intra.invalid/preview/document-link';

export type CentreEmailCustomContentInput = {
  subject?: string | null;
  /** Full editable Centre email body (plain text with internal secure-doc markers). */
  body?: string | null;
  /** @deprecated Legacy intro-only field; mapped to body when body is omitted. */
  message?: string | null;
};

export type ResolvedCentreEmailCustomContent = {
  subject: string;
  body: string;
  customized: boolean;
};

export function normalizeCentreEmailCustomContent(
  input: CentreEmailCustomContentInput | undefined,
  defaults: { subject: string; body: string },
): ResolvedCentreEmailCustomContent {
  const subjectProvided = input?.subject != null;
  const bodyProvided = input?.body != null || input?.message != null;
  const subject = subjectProvided ? validateCentreEmailSubject(input!.subject!) : defaults.subject;
  const rawBody =
    input?.body != null
      ? input.body
      : input?.message != null
        ? input.message
        : defaults.body;
  const body = bodyProvided ? validateCentreEmailBody(rawBody!) : defaults.body;
  const customized =
    (subjectProvided && subject !== defaults.subject) || (bodyProvided && body !== defaults.body);
  return { subject, body, customized };
}

export function validateCentreEmailSubject(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException('Centre email subject is required.');
  }
  if (trimmed.length > CENTRE_EMAIL_CUSTOM_SUBJECT_MAX) {
    throw new BadRequestException(
      `Centre email subject must be at most ${CENTRE_EMAIL_CUSTOM_SUBJECT_MAX} characters.`,
    );
  }
  return trimmed;
}

export function validateCentreEmailBody(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n');
  if (normalized.length > CENTRE_EMAIL_CUSTOM_BODY_MAX) {
    throw new BadRequestException(
      `Centre email body must be at most ${CENTRE_EMAIL_CUSTOM_BODY_MAX} characters.`,
    );
  }
  if (/<\s*\/?\s*(script|iframe|object|embed|link|meta|style|img|svg|form|input|button|textarea|select)\b/i.test(
    normalized,
  )) {
    throw new BadRequestException('Centre email body cannot contain HTML markup.');
  }
  return normalized;
}

/** @deprecated Use validateCentreEmailBody */
export function validateCentreEmailMessage(value: string): string {
  return validateCentreEmailBody(value);
}

export function renderCentreEmailCustomMessageHtml(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return '';
  return escapeShiftAssignmentEmailHtml(trimmed).replace(/\n/g, '<br/>');
}

export function renderCentreEmailCustomMessageHtmlRows(message: string): string {
  const html = renderCentreEmailCustomMessageHtml(message);
  if (!html) return '';
  return `<tr><td style="padding-top:16px;font-size:15px;line-height:1.6;color:#333;">${html}</td></tr>`;
}

export function documentShareUrlForCentreEmailPreview(url: string, previewMode: boolean): string {
  return previewMode ? CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_HREF : url;
}

export function documentShareLabelForCentreEmailPreview(previewMode: boolean): string | null {
  return previewMode ? CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_LABEL : null;
}
