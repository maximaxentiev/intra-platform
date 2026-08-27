import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { compareStaffMatchingSort } from '@intra/shared';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  centres,
  shiftContacted,
  shifts,
  staff,
  staffAccounts,
  staffCentreBanned,
  staffCentreTop,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import {
  buildComplianceInputsForStaff,
  deriveStaffShiftDocumentGate,
  type StaffDocumentCategoryComplianceInput,
  type StaffShiftDocumentGate,
} from '../staff-documents/staff-document-compliance.util';
import type {
  EligibleAvailableStaffRow,
  SameDayStaffShift,
  ShiftEligibilityResult,
  ShiftMatchingTarget,
  StaffMatchingCandidate,
} from './shift-matching.types';
import { buildStaffMatchingPriority } from './shift-matching-priority.util';
import { evaluateStaffShiftEligibility } from './shift-matching.util';
import { shiftQualificationPreferenceRank } from './shift-qualification-matching.util';

type DbLike = Pick<Database, 'select' | 'execute'>;

@Injectable()
export class ShiftMatchingService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findEligibleStaffForShift(shiftId: string): Promise<EligibleAvailableStaffRow[]> {
    const shift = await this.loadShift(shiftId);
    const context = await this.loadEvaluationContext(shift, this.db);

    const eligible: Array<EligibleAvailableStaffRow & { city: string | null }> = [];
    for (const candidate of context.candidates) {
      const result = this.evaluateCandidate(candidate, shift, context);
      if (!result.eligible) continue;

      const qualificationCategoryInputs =
        context.qualificationInputsByStaff.get(candidate.id) ?? [];
      const isTop = context.topStaffIds.has(candidate.id);

      eligible.push({
        id: candidate.id,
        legalName: candidate.legalName,
        displayName: candidate.displayName,
        useDisplayName: candidate.useDisplayName,
        role: candidate.role,
        isTop,
        contacted: context.contactedStaffIds.has(candidate.id),
        city: candidate.city,
        matchingPriority: buildStaffMatchingPriority({
          shiftRoleNeeded: shift.roleNeeded,
          isTop,
          staffCity: candidate.city,
          centreCity: shift.centreCity,
          qualificationCategoryInputs,
        }),
      });
    }

    eligible.sort((a, b) =>
      compareStaffMatchingSort(
        {
          isTop: a.isTop,
          legalName: a.legalName,
          city: a.city,
          qualificationPreferenceRank: shiftQualificationPreferenceRank(
            shift.roleNeeded,
            context.qualificationInputsByStaff.get(a.id) ?? [],
          ),
        },
        {
          isTop: b.isTop,
          legalName: b.legalName,
          city: b.city,
          qualificationPreferenceRank: shiftQualificationPreferenceRank(
            shift.roleNeeded,
            context.qualificationInputsByStaff.get(b.id) ?? [],
          ),
        },
        shift.centreCity,
      ),
    );

    return eligible.map(({ city: _city, ...row }) => row);
  }

  async evaluateStaffForShift(
    shiftId: string,
    staffId: string,
    tx: DbLike = this.db,
  ): Promise<ShiftEligibilityResult> {
    const shift = await this.loadShift(shiftId, tx);
    const context = await this.loadEvaluationContext(shift, tx, staffId);
    const candidate = context.candidates.find((row) => row.id === staffId);
    if (!candidate) {
      return { eligible: false, reasons: [] };
    }
    return this.evaluateCandidate(candidate, shift, context);
  }

  private evaluateCandidate(
    candidate: StaffMatchingCandidate,
    shift: ShiftMatchingTarget,
    context: EvaluationContext,
  ): ShiftEligibilityResult {
    return evaluateStaffShiftEligibility({
      staffId: candidate.id,
      staffRole: candidate.role,
      account: candidate.account,
      isCentreBanned: context.bannedStaffIds.has(candidate.id),
      hasAvailabilityCoverage: context.availableStaffIds.has(candidate.id),
      sameDayShifts: context.sameDayShifts,
      documentGate: context.documentGates.get(candidate.id) ?? emptyDocumentGate(),
      qualificationCategoryInputs: context.qualificationInputsByStaff.get(candidate.id) ?? [],
      shift,
    });
  }

  private async loadShift(shiftId: string, db: DbLike = this.db): Promise<ShiftMatchingTarget> {
    const rows = await db
      .select({
        id: shifts.id,
        centreId: shifts.centreId,
        centreCity: centres.city,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .where(eq(shifts.id, shiftId));
    if (!rows[0]) throw new NotFoundException('Shift not found.');
    return rows[0];
  }

  private async loadEvaluationContext(
    shift: ShiftMatchingTarget,
    db: DbLike,
    staffIdFilter?: string,
  ): Promise<EvaluationContext> {
    const candidateQuery = db
      .select({
        id: staff.id,
        legalName: staff.legalName,
        displayName: staff.displayName,
        useDisplayName: staff.useDisplayName,
        role: staff.role,
        city: staff.city,
        accountStatus: staffAccounts.status,
        onboardingCompletedAt: staffAccounts.onboardingCompletedAt,
      })
      .from(staff)
      .leftJoin(staffAccounts, eq(staffAccounts.staffId, staff.id));

    const candidatesRows = staffIdFilter
      ? await candidateQuery.where(eq(staff.id, staffIdFilter))
      : await candidateQuery.orderBy(asc(staff.legalName));

    const candidates: StaffMatchingCandidate[] = candidatesRows.map((row) => ({
      id: row.id,
      legalName: row.legalName,
      displayName: row.displayName,
      useDisplayName: row.useDisplayName,
      role: row.role,
      city: row.city,
      account: row.accountStatus
        ? {
            status: row.accountStatus,
            onboardingCompletedAt: row.onboardingCompletedAt,
          }
        : null,
    }));

    const staffIds = candidates.map((row) => row.id);

    const [banned, top, contacted, availableStaffIds, sameDayShifts, documentCompliance] =
      await Promise.all([
        db
          .select({ staffId: staffCentreBanned.staffId })
          .from(staffCentreBanned)
          .where(eq(staffCentreBanned.centreId, shift.centreId)),
        db
          .select({ staffId: staffCentreTop.staffId })
          .from(staffCentreTop)
          .where(eq(staffCentreTop.centreId, shift.centreId)),
        db
          .select({ staffId: shiftContacted.staffId })
          .from(shiftContacted)
          .where(eq(shiftContacted.shiftId, shift.id)),
        this.loadStaffIdsWithAvailabilityCoverage(db, shift),
        this.loadSameDayShifts(db, shift),
        this.loadDocumentCompliance(db, staffIds),
      ]);

    return {
      candidates,
      bannedStaffIds: new Set(banned.map((row) => row.staffId)),
      topStaffIds: new Set(top.map((row) => row.staffId)),
      contactedStaffIds: new Set(contacted.map((row) => row.staffId)),
      availableStaffIds,
      sameDayShifts,
      documentGates: documentCompliance.gates,
      qualificationInputsByStaff: documentCompliance.inputsByStaff,
    };
  }

  private async loadStaffIdsWithAvailabilityCoverage(
    db: DbLike,
    shift: ShiftMatchingTarget,
  ): Promise<Set<string>> {
    const result = await db.execute<{ staff_id: string }>(sql`
      SELECT DISTINCT a.staff_id
      FROM availability a
      WHERE (a.week_start_date + a.day_of_week)::date = ${shift.shiftDate}::date
        AND a.start_time <= ${shift.startTime}::time
        AND a.end_time >= ${shift.endTime}::time
    `);
    const rows = Array.isArray(result) ? result : (result.rows ?? []);
    return new Set(rows.map((row) => row.staff_id));
  }

  private async loadSameDayShifts(
    db: DbLike,
    shift: ShiftMatchingTarget,
  ): Promise<SameDayStaffShift[]> {
    const rows = await db
      .select({
        id: shifts.id,
        assignedStaffId: shifts.assignedStaffId,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        status: shifts.status,
      })
      .from(shifts)
      .where(and(eq(shifts.shiftDate, shift.shiftDate), ne(shifts.id, shift.id)));

    return rows
      .filter((row): row is typeof row & { assignedStaffId: string } => Boolean(row.assignedStaffId))
      .map((row) => ({
        id: row.id,
        assignedStaffId: row.assignedStaffId,
        startTime: row.startTime,
        endTime: row.endTime,
        status: row.status,
      }));
  }

  private async loadDocumentCompliance(
    db: DbLike,
    staffIds: string[],
  ): Promise<{
    gates: Map<string, StaffShiftDocumentGate>;
    inputsByStaff: Map<string, StaffDocumentCategoryComplianceInput[]>;
  }> {
    const gates = new Map<string, StaffShiftDocumentGate>();
    const inputsByStaff = new Map<string, StaffDocumentCategoryComplianceInput[]>();
    if (staffIds.length === 0) return { gates, inputsByStaff };

    const sets = await db
      .select()
      .from(staffDocumentSets)
      .where(inArray(staffDocumentSets.staffId, staffIds));

    const currentSubmissionIds = sets
      .map((set) => set.currentSubmissionId)
      .filter((id): id is string => Boolean(id));

    const submissions =
      currentSubmissionIds.length > 0
        ? await db
            .select()
            .from(staffDocumentSubmissions)
            .where(inArray(staffDocumentSubmissions.id, currentSubmissionIds))
        : [];

    const submissionById = new Map(submissions.map((row) => [row.id, row]));

    const files =
      currentSubmissionIds.length > 0
        ? await db
            .select({ submissionId: staffDocumentFiles.submissionId })
            .from(staffDocumentFiles)
            .where(inArray(staffDocumentFiles.submissionId, currentSubmissionIds))
        : [];

    const fileCountBySubmission = new Map<string, number>();
    for (const file of files) {
      fileCountBySubmission.set(
        file.submissionId,
        (fileCountBySubmission.get(file.submissionId) ?? 0) + 1,
      );
    }

    const setsByStaff = new Map<string, typeof sets>();
    for (const set of sets) {
      const bucket = setsByStaff.get(set.staffId) ?? [];
      bucket.push(set);
      setsByStaff.set(set.staffId, bucket);
    }

    for (const staffId of staffIds) {
      const staffSets = setsByStaff.get(staffId) ?? [];
      const inputs = buildComplianceInputsForStaff(staffSets, submissionById, fileCountBySubmission);
      inputsByStaff.set(staffId, inputs);
      gates.set(staffId, deriveStaffShiftDocumentGate(inputs));
    }

    return { gates, inputsByStaff };
  }
}

type EvaluationContext = {
  candidates: StaffMatchingCandidate[];
  bannedStaffIds: Set<string>;
  topStaffIds: Set<string>;
  contactedStaffIds: Set<string>;
  availableStaffIds: Set<string>;
  sameDayShifts: SameDayStaffShift[];
  documentGates: Map<string, StaffShiftDocumentGate>;
  qualificationInputsByStaff: Map<string, StaffDocumentCategoryComplianceInput[]>;
};

function emptyDocumentGate(): StaffShiftDocumentGate {
  return deriveStaffShiftDocumentGate([]);
}
