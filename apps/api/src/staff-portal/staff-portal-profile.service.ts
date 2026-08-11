import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { staff, staffAccounts } from '../db/schema';
import { composeLegalName } from './legal-name.util';
import { normalizeStaffEmail } from './portal-account-status.util';
import { PatchStaffPortalProfileDto } from './dto/staff-portal-profile.dto';
import {
  ONBOARDING_STEP,
  step1RequiredFieldIssues,
} from './staff-onboarding.util';
import type { StaffSessionPayload } from './staff-session.service';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from './staff-portal-audit.service';
import { assertCityForUpdate } from '../common/city-validation';

export type StaffPortalProfileDto = {
  legalFirstName: string;
  legalLastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  profileCompletedAt: string | null;
  documentsCompletedAt: string | null;
  onboardingStep: number;
  onboardingCompletedAt: string | null;
};

@Injectable()
export class StaffPortalProfileService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: StaffPortalAuditService,
  ) {}

  async getProfile(session: StaffSessionPayload): Promise<StaffPortalProfileDto> {
    const { account, person } = await this.loadSelf(session);
    return this.toDto(account, person);
  }

  async updateProfile(
    session: StaffSessionPayload,
    dto: PatchStaffPortalProfileDto,
  ): Promise<StaffPortalProfileDto> {
    const { account, person } = await this.loadSelf(session);
    const normalized = this.normalizeDto(dto, person.city);
    const changedFields = this.diffFields(person, account, normalized);

    if (changedFields.length === 0) {
      return this.toDto(account, person);
    }

    await this.persistProfile(account, person, normalized);

    await this.audit.record({
      staffId: account.staffId,
      staffAccountId: account.id,
      eventType: STAFF_PORTAL_AUDIT_EVENTS.carerProfileUpdated,
      detail: { source: 'carer_portal', changedFields },
    });

    const refreshed = await this.loadSelf(session);
    return this.toDto(refreshed.account, refreshed.person);
  }

  /** Marks Step 1 complete when required fields are present. Idempotent. */
  async completeProfileStep(session: StaffSessionPayload): Promise<StaffPortalProfileDto> {
    const { account, person } = await this.loadSelf(session);
    const missing = step1RequiredFieldIssues(person);
    if (missing.length) {
      throw new BadRequestException('Complete all personal information fields before continuing.');
    }

    const now = new Date();
    const alreadyComplete = Boolean(account.profileCompletedAt);

    if (!alreadyComplete) {
      await this.db
        .update(staffAccounts)
        .set({
          profileCompletedAt: now,
          onboardingStep: Math.max(account.onboardingStep, ONBOARDING_STEP.documents),
          updatedAt: now,
        })
        .where(eq(staffAccounts.id, account.id));

      await this.audit.record({
        staffId: account.staffId,
        staffAccountId: account.id,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.onboardingStep1Completed,
        detail: { source: 'carer_portal' },
      });
    }

    const refreshed = await this.loadSelf(session);
    return this.toDto(refreshed.account, refreshed.person);
  }

  private normalizeDto(dto: PatchStaffPortalProfileDto, previousCity: string) {
    return {
      legalFirstName: dto.legalFirstName.trim(),
      legalLastName: dto.legalLastName.trim(),
      email: normalizeStaffEmail(dto.email),
      phone: dto.phone.trim(),
      address: dto.address.trim(),
      city: assertCityForUpdate(dto.city.trim(), previousCity),
    };
  }

  private diffFields(
    person: typeof staff.$inferSelect,
    account: typeof staffAccounts.$inferSelect,
    next: ReturnType<StaffPortalProfileService['normalizeDto']>,
  ): string[] {
    const changed: string[] = [];
    if (person.legalFirstName !== next.legalFirstName) changed.push('legalFirstName');
    if (person.legalLastName !== next.legalLastName) changed.push('legalLastName');
    if (person.phone !== next.phone) changed.push('phone');
    if (person.address !== next.address) changed.push('address');
    if (person.city !== next.city) changed.push('city');
    if (person.email !== next.email) changed.push('email');
    if (account.email !== next.email) changed.push('portalEmail');
    return changed;
  }

  private async persistProfile(
    account: typeof staffAccounts.$inferSelect,
    person: typeof staff.$inferSelect,
    next: ReturnType<StaffPortalProfileService['normalizeDto']>,
  ) {
    if (next.email !== person.email || next.email !== account.email) {
      await this.assertEmailAvailable(next.email, account.staffId);
    }

    const legalName = composeLegalName(next.legalFirstName, next.legalLastName);
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(staff)
        .set({
          legalFirstName: next.legalFirstName,
          legalLastName: next.legalLastName,
          legalName,
          email: next.email,
          phone: next.phone,
          address: next.address,
          city: next.city,
          updatedAt: now,
        })
        .where(eq(staff.id, account.staffId));

      if (next.email !== account.email) {
        await tx
          .update(staffAccounts)
          .set({ email: next.email, updatedAt: now })
          .where(eq(staffAccounts.id, account.id));
      } else {
        await tx
          .update(staffAccounts)
          .set({ updatedAt: now })
          .where(eq(staffAccounts.id, account.id));
      }
    });
  }

  private async assertEmailAvailable(email: string, staffId: string) {
    const staffRows = await this.db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.email, email), ne(staff.id, staffId)));
    if (staffRows.length) {
      throw new ConflictException('A staff member with this email address already exists.');
    }

    const portalRows = await this.db
      .select({ staffId: staffAccounts.staffId })
      .from(staffAccounts)
      .where(eq(staffAccounts.email, email));
    if (portalRows.some((r) => r.staffId !== staffId)) {
      throw new ConflictException('This email is already used by another portal account.');
    }
  }

  private async loadSelf(session: StaffSessionPayload) {
    const account = (
      await this.db.select().from(staffAccounts).where(eq(staffAccounts.id, session.accountId))
    )[0];
    if (!account || account.status === 'disabled') {
      throw new UnauthorizedException('Not authenticated.');
    }
    if (account.staffId !== session.staffId) {
      throw new UnauthorizedException('Not authenticated.');
    }
    const person = (await this.db.select().from(staff).where(eq(staff.id, account.staffId)))[0];
    if (!person) throw new UnauthorizedException('Not authenticated.');
    return { account, person };
  }

  private toDto(
    account: typeof staffAccounts.$inferSelect,
    person: typeof staff.$inferSelect,
  ): StaffPortalProfileDto {
    return {
      legalFirstName: person.legalFirstName,
      legalLastName: person.legalLastName,
      email: person.email,
      phone: person.phone,
      address: person.address,
      city: person.city,
      profileCompletedAt: account.profileCompletedAt?.toISOString() ?? null,
      documentsCompletedAt: account.documentsCompletedAt?.toISOString() ?? null,
      onboardingStep: account.onboardingStep,
      onboardingCompletedAt: account.onboardingCompletedAt?.toISOString() ?? null,
    };
  }
}
