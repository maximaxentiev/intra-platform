import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { staffAccounts } from '../db/schema';
import type { StaffPortalOnboardingStatusDto } from './dto/staff-portal-onboarding.dto';
import { ONBOARDING_STEP } from './staff-onboarding.util';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from './staff-portal-audit.service';
import {
  buildStaffPortalOnboardingStatus,
  isAvailabilityStepComplete,
} from './staff-portal-onboarding-status.util';
import type { StaffSessionPayload } from './staff-session.service';

@Injectable()
export class StaffPortalOnboardingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: StaffPortalAuditService,
  ) {}

  getStatus(account: typeof staffAccounts.$inferSelect): StaffPortalOnboardingStatusDto {
    return buildStaffPortalOnboardingStatus(account);
  }

  /** Marks the guided availability onboarding step complete. Does not finalize onboarding. */
  async completeAvailabilityStep(
    session: StaffSessionPayload,
  ): Promise<StaffPortalOnboardingStatusDto> {
    const account = await this.loadActiveAccount(session);

    if (!account.profileCompletedAt) {
      throw new BadRequestException(
        'Complete your profile before finishing your availability step.',
      );
    }
    if (!account.documentsCompletedAt) {
      throw new BadRequestException(
        'Complete your documents before finishing your availability step.',
      );
    }

    if (isAvailabilityStepComplete(account)) {
      return buildStaffPortalOnboardingStatus(account);
    }

    if (!account.availabilityOnboardingWeek1Start) {
      throw new BadRequestException(
        'Establish your availability onboarding period before completing your availability step.',
      );
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      const locked = await this.loadAccountForUpdateTx(tx, session.accountId, session.staffId);

      if (isAvailabilityStepComplete(locked)) {
        return;
      }

      if (!locked.profileCompletedAt) {
        throw new BadRequestException(
          'Complete your profile before finishing your availability step.',
        );
      }
      if (!locked.documentsCompletedAt) {
        throw new BadRequestException(
          'Complete your documents before finishing your availability step.',
        );
      }
      if (!locked.availabilityOnboardingWeek1Start) {
        throw new BadRequestException(
          'Establish your availability onboarding period before completing your availability step.',
        );
      }

      await tx
        .update(staffAccounts)
        .set({
          availabilityCompletedAt: now,
          onboardingStep: Math.max(locked.onboardingStep, ONBOARDING_STEP.availability),
          updatedAt: now,
        })
        .where(eq(staffAccounts.id, locked.id));

      await this.audit.record(
        {
          staffId: locked.staffId,
          staffAccountId: locked.id,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.onboardingAvailabilityStepCompleted,
          detail: { source: 'carer_portal' },
        },
        tx,
      );
    });

    const refreshed = await this.loadActiveAccount(session);
    return buildStaffPortalOnboardingStatus(refreshed);
  }

  /** Finalizes onboarding from the hub after all three steps are complete. */
  async completeOnboarding(session: StaffSessionPayload): Promise<StaffPortalOnboardingStatusDto> {
    const account = await this.loadActiveAccount(session);

    if (account.onboardingCompletedAt) {
      return buildStaffPortalOnboardingStatus(account);
    }

    this.assertCanCompleteOnboarding(account);

    const now = new Date();
    await this.db.transaction(async (tx) => {
      const locked = await this.loadAccountForUpdateTx(tx, session.accountId, session.staffId);

      if (locked.onboardingCompletedAt) {
        return;
      }

      this.assertCanCompleteOnboarding(locked);

      await tx
        .update(staffAccounts)
        .set({
          onboardingCompletedAt: now,
          updatedAt: now,
        })
        .where(eq(staffAccounts.id, locked.id));

      await this.audit.record(
        {
          staffId: locked.staffId,
          staffAccountId: locked.id,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.onboardingCompleted,
          detail: { source: 'carer_portal' },
        },
        tx,
      );
    });

    const refreshed = await this.loadActiveAccount(session);
    return buildStaffPortalOnboardingStatus(refreshed);
  }

  private assertCanCompleteOnboarding(account: typeof staffAccounts.$inferSelect) {
    const status = buildStaffPortalOnboardingStatus(account);
    if (!status.profileComplete) {
      throw new BadRequestException(
        'Complete your personal information before finishing onboarding.',
      );
    }
    if (!status.documentsComplete) {
      throw new BadRequestException('Complete your documents before finishing onboarding.');
    }
    if (!status.availabilityComplete) {
      throw new BadRequestException(
        'Complete your availability step before finishing onboarding.',
      );
    }
  }

  private async loadActiveAccount(session: StaffSessionPayload) {
    const account = (
      await this.db.select().from(staffAccounts).where(eq(staffAccounts.id, session.accountId))
    )[0];
    if (!account || account.status === 'disabled') {
      throw new UnauthorizedException('Not authenticated.');
    }
    if (account.staffId !== session.staffId) {
      throw new UnauthorizedException('Not authenticated.');
    }
    return account;
  }

  private async loadAccountForUpdateTx(
    tx: Pick<Database, 'select'>,
    accountId: string,
    staffId: string,
  ) {
    const rows = await tx
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.id, accountId))
      .for('update');
    const account = rows[0];
    if (!account || account.status === 'disabled' || account.staffId !== staffId) {
      throw new UnauthorizedException('Not authenticated.');
    }
    return account;
  }
}
