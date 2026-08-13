import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { staff } from '../db/schema';
import { shareTokenRotationEpochFromPersisted } from './staff-document-share-epoch.util';
import { PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE } from './staff-document-share-public.constants';
import {
  clearStaffDocumentShareSessionCookieOptions,
  staffDocumentShareSessionCookieName,
  type StaffDocumentShareSessionPayload,
} from './staff-document-share-session.util';
import {
  isStaffDocumentShareTokenActive,
  type StaffDocumentShareFields,
} from './staff-document-share-state.util';
import { StaffDocumentShareService } from './staff-document-share.service';
import {
  hashPublicShareDiagId,
  logPublicShareFileAuthDecision,
  type PublicShareAuthPhase,
} from './staff-document-share-public-file-auth-diag.util';

export type PublicShareAuthorizedContext = {
  staffId: string;
  staff: typeof staff.$inferSelect;
  session: StaffDocumentShareSessionPayload;
};

@Injectable()
export class StaffDocumentSharePublicAuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly share: StaffDocumentShareService,
    private readonly config: ConfigService,
  ) {}

  cookieName(): string {
    return staffDocumentShareSessionCookieName();
  }

  setSessionCookie(res: Response, value: string): void {
    res.cookie(this.cookieName(), value, this.share.shareSessionCookieOptions(this.cookieConfig()));
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie(this.cookieName(), clearStaffDocumentShareSessionCookieOptions(this.cookieConfig()));
  }

  async authorizeFromRequest(
    req: Request,
    phase: PublicShareAuthPhase = 'metadata',
  ): Promise<PublicShareAuthorizedContext> {
    const cookieName = this.cookieName();
    const sessionValue = req.cookies?.[cookieName];
    if (!sessionValue || typeof sessionValue !== 'string') {
      logPublicShareFileAuthDecision(phase, 'share_session_missing', {
        cookiePresent: Boolean(sessionValue),
        cookieName,
      });
      throw this.unavailable();
    }

    const session = this.share.verifyShareSession(sessionValue);
    if (!session) {
      logPublicShareFileAuthDecision(phase, 'share_session_invalid', {
        sessionPresent: true,
      });
      throw this.unavailable();
    }

    return this.authorizeSession(session, phase);
  }

  async authorizeSession(
    session: StaffDocumentShareSessionPayload,
    phase: PublicShareAuthPhase = 'metadata',
  ): Promise<PublicShareAuthorizedContext> {
    const rows = await this.db.select().from(staff).where(eq(staff.id, session.staffId));
    const row = rows[0];
    if (!row) {
      logPublicShareFileAuthDecision(phase, 'staff_not_found', {
        staffIdHash: hashPublicShareDiagId(session.staffId),
      });
      throw this.unavailable();
    }

    const shareFields = this.shareFields(row);
    if (!isStaffDocumentShareTokenActive(shareFields)) {
      logPublicShareFileAuthDecision(phase, 'share_inactive', {
        staffIdHash: hashPublicShareDiagId(row.id),
      });
      throw this.unavailable();
    }

    if (!this.share.assertShareSessionValidForStaff(session, row.id, shareFields)) {
      logPublicShareFileAuthDecision(phase, 'share_epoch_mismatch', {
        staffIdHash: hashPublicShareDiagId(row.id),
        sessionStaffMatches: session.staffId === row.id,
      });
      throw this.unavailable();
    }

    return { staffId: row.id, staff: row, session };
  }

  shareFields(row: Pick<
    typeof staff.$inferSelect,
    'documentShareTokenHash' | 'documentShareTokenCreatedAt' | 'documentShareTokenRevokedAt'
  >): StaffDocumentShareFields {
    return {
      documentShareTokenHash: row.documentShareTokenHash,
      documentShareTokenCreatedAt: row.documentShareTokenCreatedAt,
      documentShareTokenRevokedAt: row.documentShareTokenRevokedAt,
    };
  }

  tokenIssuedAtForStaff(row: typeof staff.$inferSelect): number | null {
    return shareTokenRotationEpochFromPersisted(row.documentShareTokenCreatedAt);
  }

  isActiveShareState(row: typeof staff.$inferSelect): boolean {
    return isStaffDocumentShareTokenActive(this.shareFields(row));
  }

  unavailable(): NotFoundException {
    return new NotFoundException(PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE);
  }

  private cookieConfig() {
    return { secure: this.config.get<string>('SESSION_COOKIE_SECURE') === 'true' };
  }
}
