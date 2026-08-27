import type { users } from '../db/schema';

/** Public Ops user profile returned by auth and user administration APIs. */
export type OpsUserProfile = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'ops';
  isActive: boolean;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toOpsUserProfile(row: typeof users.$inferSelect): OpsUserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword === true,
    temporaryPasswordExpiresAt: row.temporaryPasswordExpiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
