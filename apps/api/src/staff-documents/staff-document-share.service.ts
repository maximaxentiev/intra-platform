import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nextShareTokenRotationCreatedAt, shareTokenRotationEpochFromPersisted } from './staff-document-share-epoch.util';
import {
  assertShareSessionMatchesStaffShareState,
  buildShareTokenPersistValues,
  buildShareTokenRevokeValues,
  isStaffDocumentShareTokenActive,
  type StaffDocumentShareFields,
  type StaffDocumentShareTokenPersistValues,
  type StaffDocumentShareTokenRevokeValues,
} from './staff-document-share-state.util';
import {
  signStaffDocumentShareSession,
  staffDocumentShareSessionCookieOptions,
  staffDocumentShareSessionCookieName,
  verifyStaffDocumentShareSession,
  type StaffDocumentShareSessionCookieConfig,
  type StaffDocumentShareSessionPayload,
} from './staff-document-share-session.util';
import {
  deriveStaffDocumentShareToken,
  hashStaffDocumentShareToken,
  verifyStaffDocumentShareToken,
} from './staff-document-share-token.util';

export interface StaffDocumentShareTokenGenerationResult {
  /** Same timestamp persisted as document_share_token_created_at. */
  createdAt: Date;
  /** Raw derived token — never persisted; for future Ops copy-link responses. */
  token: string;
  /** SHA-256 hex hash — persisted as document_share_token_hash. */
  hash: string;
}

@Injectable()
export class StaffDocumentShareService {
  constructor(private readonly config: ConfigService) {}

  generateShareTokenState(
    staffId: string,
    createdAt: Date = new Date(),
  ): StaffDocumentShareTokenGenerationResult {
    const token = deriveStaffDocumentShareToken(this.signingSecret(), staffId, createdAt);
    const hash = hashStaffDocumentShareToken(token);
    return { createdAt, token, hash };
  }

  buildPersistValuesForGeneration(
    staffId: string,
    createdAt: Date = new Date(),
  ): StaffDocumentShareTokenGenerationResult & {
    persist: StaffDocumentShareTokenPersistValues;
  } {
    const generated = this.generateShareTokenState(staffId, createdAt);
    return {
      ...generated,
      persist: buildShareTokenPersistValues({
        createdAt: generated.createdAt,
        hash: generated.hash,
      }),
    };
  }

  /** Rotation always issues a new epoch/token/hash and clears revocation. */
  buildPersistValuesForRotation(
    staffId: string,
    previousCreatedAt: Date | null,
    nowMs?: number,
  ): StaffDocumentShareTokenGenerationResult & {
    persist: StaffDocumentShareTokenPersistValues;
  } {
    const createdAt = nextShareTokenRotationCreatedAt(previousCreatedAt, nowMs);
    return this.buildPersistValuesForGeneration(staffId, createdAt);
  }

  buildRevokeValues(revokedAt: Date = new Date()): StaffDocumentShareTokenRevokeValues {
    return buildShareTokenRevokeValues(revokedAt);
  }

  /**
   * Reconstruct the active raw token for Copy Link / shift emails.
   * Returns null when share state is incomplete, inactive, or revoked.
   */
  reconstructActiveShareToken(
    staffId: string,
    shareFields: StaffDocumentShareFields,
  ): string | null {
    if (!isStaffDocumentShareTokenActive(shareFields)) {
      return null;
    }
    return deriveStaffDocumentShareToken(
      this.signingSecret(),
      staffId,
      shareFields.documentShareTokenCreatedAt!,
    );
  }

  verifyShareToken(
    staffId: string,
    shareFields: StaffDocumentShareFields,
    providedToken: string,
  ): boolean {
    if (!isStaffDocumentShareTokenActive(shareFields)) {
      return false;
    }
    return verifyStaffDocumentShareToken(
      this.signingSecret(),
      staffId,
      shareFields.documentShareTokenCreatedAt!,
      providedToken,
      shareFields.documentShareTokenHash!,
    );
  }

  signShareSession(staffId: string, tokenIssuedAt: number, nowMs?: number): string {
    return signStaffDocumentShareSession(this.signingSecret(), {
      staffId,
      tokenIssuedAt,
      nowMs,
    });
  }

  verifyShareSession(sessionValue: string, nowMs?: number): StaffDocumentShareSessionPayload | null {
    return verifyStaffDocumentShareSession(this.signingSecret(), sessionValue, nowMs);
  }

  assertShareSessionValidForStaff(
    session: StaffDocumentShareSessionPayload,
    staffId: string,
    shareFields: StaffDocumentShareFields,
  ): boolean {
    return assertShareSessionMatchesStaffShareState({
      sessionStaffId: session.staffId,
      sessionTokenIssuedAt: session.tokenIssuedAt,
      staffId,
      shareFields,
    });
  }

  shareSessionCookieName(): string {
    return staffDocumentShareSessionCookieName();
  }

  shareSessionCookieOptions(config: StaffDocumentShareSessionCookieConfig) {
    return staffDocumentShareSessionCookieOptions(config);
  }

  rotationEpochFromPersisted(createdAt: Date | string | null | undefined): number | null {
    return shareTokenRotationEpochFromPersisted(createdAt);
  }

  private signingSecret(): string {
    return this.config.getOrThrow<string>('DOCUMENT_SHARE_SIGNING_SECRET');
  }
}
