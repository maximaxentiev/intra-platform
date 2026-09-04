import { BadRequestException } from '@nestjs/common';
import { escapeShiftAssignmentEmailHtml } from '../shifts/shift-assignment-notification.util';

export const CENTRE_EMAIL_CUSTOM_SUBJECT_MAX = 200;
export const CENTRE_EMAIL_CUSTOM_MESSAGE_MAX = 10_000;

export const CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_LABEL =
  'Secure document link will be included when this email is sent.';

/** Non-routable placeholder used only in Ops preview HTML. */
export const CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_HREF = 'https://intra.invalid/preview/document-link';

export type CentreEmailCustomContentInput = {
  subject?: string | null;
  message?: string | null;
};

export type ResolvedCentreEmailCustomContent = {
  subject: string;
  message: string;
  customized: boolean;
};

export function normalizeCentreEmailCustomContent(
  input: CentreEmailCustomContentInput | undefined,
  defaults: { subject: string; message: string },
): ResolvedCentreEmailCustomContent {
  const subjectProvided = input?.subject != null;
  const messageProvided = input?.message != null;
  const subject = subjectProvided ? validateCentreEmailSubject(input!.subject!) : defaults.subject;
  const message = messageProvided ? validateCentreEmailMessage(input!.message!) : defaults.message;
  const customized =
    (subjectProvided && subject !== defaults.subject) ||
    (messageProvided && message !== defaults.message);
  return { subject, message, customized };
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

export function validateCentreEmailMessage(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n');
  if (normalized.length > CENTRE_EMAIL_CUSTOM_MESSAGE_MAX) {
    throw new BadRequestException(
      `Centre email message must be at most ${CENTRE_EMAIL_CUSTOM_MESSAGE_MAX} characters.`,
    );
  }
  return normalized;
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
