import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { resolvePublicPlatformUrl } from '../config/platform-url';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import { staff } from '../db/schema';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from '../staff-portal/staff-portal-audit.service';
import {
  mapStaffDocumentShareStatus,
  type StaffDocumentShareStatusDto,
  type StaffDocumentShareUrlDto,
} from './dto/staff-document-share.dto';
import { nextShareTokenRotationCreatedAt } from './staff-document-share-epoch.util';
import {
  baseStaffDocumentSlugFromStaff,
  isStaffDocumentSlugUniqueViolation,
  staffDocumentSlugCandidates,
} from './staff-document-share-slug.util';
import {
  isStaffDocumentShareTokenActive,
  resolveStaffDocumentShareTokenState,
} from './staff-document-share-state.util';
import { StaffDocumentShareService } from './staff-document-share.service';
import { buildStaffDocumentShareUrl } from './staff-document-share-url.util';

type StaffShareRow = typeof staff.$inferSelect;

@Injectable()
export class StaffDocumentShareLifecycleService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly share: StaffDocumentShareService,
    private readonly audit: StaffPortalAuditService,
    private readonly config: ConfigService,
  ) {}

  async getShareStatus(staffId: string): Promise<StaffDocumentShareStatusDto> {
    const row = await this.requireStaffRow(staffId);
    return mapStaffDocumentShareStatus(row);
  }

  async generateShareLink(staffId: string, actorUserId: string): Promise<StaffDocumentShareUrlDto> {
    return this.db.transaction(async (tx) => {
      const row = await this.lockStaffRow(tx, staffId);
      const state = resolveStaffDocumentShareTokenState(this.shareFields(row));

      if (state === 'active') {
        throw new ConflictException(
          'An active share link already exists. Use Copy Link or Rotate instead of Generate.',
        );
      }

      const createdAt = nextShareTokenRotationCreatedAt(row.documentShareTokenCreatedAt);
      const generated = this.share.generateShareTokenState(staffId, createdAt);
      const slug = await this.resolveSlugForIssuance(tx, row);
      const updated = await this.persistActiveShareState(tx, staffId, {
        slug,
        persist: this.share.buildPersistValuesForGeneration(staffId, createdAt).persist,
        generated,
      });

      await this.audit.record(
        {
          staffId,
          actorUserId,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.shareLinkGenerated,
          detail: {
            action: 'share_link_generated',
            slug: updated.documentSlug,
            createdAt: updated.documentShareTokenCreatedAt?.toISOString(),
          },
        },
        tx,
      );

      return this.toShareUrlDto(staffId, updated, generated.token);
    });
  }

  async copyShareLink(staffId: string): Promise<StaffDocumentShareUrlDto> {
    const row = await this.requireStaffRow(staffId);
    if (!isStaffDocumentShareTokenActive(this.shareFields(row))) {
      throw new ConflictException('No active share link is available to copy.');
    }
    if (!row.documentSlug) {
      throw new ConflictException('No active share link is available to copy.');
    }

    const token = this.share.reconstructActiveShareToken(staffId, this.shareFields(row));
    if (!token) {
      throw new ConflictException('No active share link is available to copy.');
    }

    return this.toShareUrlDto(staffId, row, token);
  }

  async rotateShareLink(staffId: string, actorUserId: string): Promise<StaffDocumentShareUrlDto> {
    return this.db.transaction(async (tx) => {
      const row = await this.lockStaffRow(tx, staffId);
      if (!isStaffDocumentShareTokenActive(this.shareFields(row))) {
        throw new ConflictException('No active share link exists to rotate.');
      }
      if (!row.documentSlug) {
        throw new ConflictException('No active share link exists to rotate.');
      }

      const createdAt = nextShareTokenRotationCreatedAt(row.documentShareTokenCreatedAt);
      const generated = this.share.generateShareTokenState(staffId, createdAt);
      const updated = await this.persistActiveShareState(tx, staffId, {
        slug: row.documentSlug,
        persist: this.share.buildPersistValuesForGeneration(staffId, createdAt).persist,
        generated,
      });

      await this.audit.record(
        {
          staffId,
          actorUserId,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.shareLinkRotated,
          detail: {
            action: 'share_link_rotated',
            slug: updated.documentSlug,
            createdAt: updated.documentShareTokenCreatedAt?.toISOString(),
          },
        },
        tx,
      );

      return this.toShareUrlDto(staffId, updated, generated.token);
    });
  }

  async revokeShareLink(staffId: string, actorUserId: string): Promise<StaffDocumentShareStatusDto> {
    return this.db.transaction(async (tx) => {
      const row = await this.lockStaffRow(tx, staffId);
      const state = resolveStaffDocumentShareTokenState(this.shareFields(row));

      if (state === 'none') {
        throw new ConflictException('No share link exists to revoke.');
      }

      if (state === 'revoked') {
        return mapStaffDocumentShareStatus(row);
      }

      const revokedAt = new Date();
      const [updated] = await tx
        .update(staff)
        .set({
          documentShareTokenRevokedAt: revokedAt,
          updatedAt: new Date(),
        })
        .where(eq(staff.id, staffId))
        .returning();

      await this.audit.record(
        {
          staffId,
          actorUserId,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.shareLinkRevoked,
          detail: {
            action: 'share_link_revoked',
            slug: updated.documentSlug,
            revokedAt: revokedAt.toISOString(),
          },
        },
        tx,
      );

      return mapStaffDocumentShareStatus(updated);
    });
  }

  /**
   * Future shift-confirmation email contract.
   * Does not generate, rotate, or un-revoke links.
   */
  async buildActiveStaffDocumentShareUrl(staffId: string): Promise<string | null> {
    const row = await this.requireStaffRow(staffId);
    if (!isStaffDocumentShareTokenActive(this.shareFields(row)) || !row.documentSlug) {
      return null;
    }
    const token = this.share.reconstructActiveShareToken(staffId, this.shareFields(row));
    if (!token) {
      return null;
    }
    return buildStaffDocumentShareUrl(this.publicBaseUrl(), row.documentSlug, token);
  }

  private async requireStaffRow(staffId: string): Promise<StaffShareRow> {
    const rows = await this.db.select().from(staff).where(eq(staff.id, staffId));
    if (!rows[0]) {
      throw new NotFoundException('Staff not found.');
    }
    return rows[0];
  }

  private async lockStaffRow(tx: DbExecutor, staffId: string): Promise<StaffShareRow> {
    const rows = await tx.select().from(staff).where(eq(staff.id, staffId)).for('update');
    if (!rows[0]) {
      throw new NotFoundException('Staff not found.');
    }
    return rows[0];
  }

  private shareFields(row: StaffShareRow) {
    return {
      documentShareTokenHash: row.documentShareTokenHash,
      documentShareTokenCreatedAt: row.documentShareTokenCreatedAt,
      documentShareTokenRevokedAt: row.documentShareTokenRevokedAt,
    };
  }

  private async resolveSlugForIssuance(tx: DbExecutor, row: StaffShareRow): Promise<string> {
    if (row.documentSlug) {
      return row.documentSlug;
    }

    const baseSlug = baseStaffDocumentSlugFromStaff(row);
    const candidates = staffDocumentSlugCandidates(baseSlug);

    for (const candidate of candidates) {
      try {
        await tx.transaction(async (slugTx) => {
          await slugTx
            .update(staff)
            .set({ documentSlug: candidate, updatedAt: new Date() })
            .where(eq(staff.id, row.id));
        });
        return candidate;
      } catch (err) {
        if (isStaffDocumentSlugUniqueViolation(err)) {
          continue;
        }
        throw err;
      }
    }

    throw new InternalServerErrorException('Unable to assign a unique document slug.');
  }

  private async persistActiveShareState(
    tx: DbExecutor,
    staffId: string,
    input: {
      slug: string;
      persist: {
        documentShareTokenHash: string;
        documentShareTokenCreatedAt: Date;
        documentShareTokenRevokedAt: null;
      };
      generated: { hash: string; createdAt: Date };
    },
  ): Promise<StaffShareRow> {
    const [updated] = await tx
      .update(staff)
      .set({
        documentSlug: input.slug,
        documentShareTokenHash: input.persist.documentShareTokenHash,
        documentShareTokenCreatedAt: input.persist.documentShareTokenCreatedAt,
        documentShareTokenRevokedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, staffId))
      .returning();

    return updated;
  }

  private toShareUrlDto(staffId: string, row: StaffShareRow, token: string): StaffDocumentShareUrlDto {
    if (!row.documentSlug) {
      throw new InternalServerErrorException('Share link slug is unavailable.');
    }
    return {
      shareUrl: buildStaffDocumentShareUrl(this.publicBaseUrl(), row.documentSlug, token),
    };
  }

  private publicBaseUrl(): string {
    return resolvePublicPlatformUrl({
      APP_PUBLIC_URL: this.config.get<string>('APP_PUBLIC_URL'),
      APP_HOST: this.config.get<string>('APP_HOST'),
      NODE_ENV: this.config.get<string>('NODE_ENV'),
    });
  }
}
