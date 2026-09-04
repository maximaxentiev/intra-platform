import { asc, eq } from 'drizzle-orm';
import type { Database } from '../db/drizzle.module';
import { platformAuditEvents } from '../db/schema';
import type { PlatformAuditAction } from '../platform-audit/platform-audit.constants';
import type { CentreEmailCustomContentInput } from './centre-email-custom-content.util';

export type StoredCentreEmailCustomContent = {
  customSubject?: string;
  customBody?: string;
  /** @deprecated Legacy field from intro-only editor. */
  customMessage?: string;
  centreEmailCustomized?: boolean;
};

export function centreEmailCustomAuditMetadata(
  content: CentreEmailCustomContentInput | undefined,
  customized: boolean,
): StoredCentreEmailCustomContent {
  if (!content && !customized) return {};
  const body = content?.body ?? content?.message;
  return {
    ...(content?.subject != null ? { customSubject: content.subject } : {}),
    ...(body != null ? { customBody: body } : {}),
    ...(customized ? { centreEmailCustomized: true } : {}),
  };
}

export async function loadCentreEmailCustomContentFromAudit(
  db: Database,
  scheduledCommunicationId: string,
  action: PlatformAuditAction,
): Promise<StoredCentreEmailCustomContent | null> {
  const rows = await db
    .select({ metadata: platformAuditEvents.metadata })
    .from(platformAuditEvents)
    .where(eq(platformAuditEvents.action, action))
    .orderBy(asc(platformAuditEvents.occurredAt));

  for (const row of rows) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    if (metadata.scheduledCommunicationId !== scheduledCommunicationId) continue;
    const customBody =
      typeof metadata.customBody === 'string'
        ? metadata.customBody
        : typeof metadata.customMessage === 'string'
          ? metadata.customMessage
          : undefined;
    return {
      customSubject:
        typeof metadata.customSubject === 'string' ? metadata.customSubject : undefined,
      customBody,
      customMessage: typeof metadata.customMessage === 'string' ? metadata.customMessage : undefined,
      centreEmailCustomized: metadata.centreEmailCustomized === true,
    };
  }

  return null;
}
