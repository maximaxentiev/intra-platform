import { asc, eq } from 'drizzle-orm';
import type { Database } from '../db/drizzle.module';
import { centreContacts } from '../db/schema';
import {
  isValidNotificationEmail,
  normalizeNotificationEmail,
} from '../shifts/shift-assignment-notification.util';

export type CentrePrimaryContact = {
  id: string;
  name: string;
  email: string;
};

/** First contact by sortOrder — the Centre primary contact. */
export async function resolveCentrePrimaryContact(
  db: Database,
  centreId: string,
): Promise<CentrePrimaryContact | null> {
  const rows = await db
    .select({
      id: centreContacts.id,
      name: centreContacts.name,
      email: centreContacts.email,
    })
    .from(centreContacts)
    .where(eq(centreContacts.centreId, centreId))
    .orderBy(asc(centreContacts.sortOrder))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const email = normalizeNotificationEmail(row.email);
  if (!email || !isValidNotificationEmail(email)) return null;

  return {
    id: row.id,
    name: row.name.trim() || 'Primary contact',
    email,
  };
}

/** Extract a friendly first name from a contact display name. */
export function centreContactFirstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0] ?? trimmed;
}
