import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
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
  type StaffShiftDocumentGate,
} from '../staff-documents/staff-document-compliance.util';
import type {
  EligibleAvailableStaffRow,
  SameDayStaffShift,
  ShiftEligibilityResult,
  ShiftMatchingTarget,
  StaffMatchingCandidate,
} from './shift-matching.types';
import { evaluateStaffShiftEligibility } from './shift-matching.util';

type DbLike = Pick<Database, 'select' | 'execute'>;

@Injectable()
export class ShiftMatchingService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findEligibleStaffForShift(shiftId: string): Promise<EligibleAvailableStaffRow[]> {
    const shift = await this.loadShift(shiftId);
    const context = await this.loadEvaluationContext(shift, this.db);

    const eligible: EligibleAvailableStaffRow[] = [];
    for (const candidate of context.candidates) {
      const result = this.evaluateCandidate(candidate, shift, context);
      if (!result.eligible) continue;
      eligible.push({
        id: candidate.id,
        legalName: candidate.legalName,
        displayName: candidate.displayName,
        useDisplayName: candidate.useDisplayName,
        role: candidate.role,
        isTop: context.topStaffIds.has(candidate.id),
        contacted: context.contactedStaffIds.has(candidate.id),
      });
    }

    eligible.sort((a, b) => {
      if (a.isTop !== b.isTop) return a.isTop ? -1 : 1;
      return a.legalName.localeCompare(b.legalName);
    });

    return eligible;
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
      return { eligible: false, reasons: ['inactive_staff'] };
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
      staffStatus: candidate.status,
      staffRole: candidate.role,
      account: candidate.account,
      isCentreBanned: context.bannedStaffIds.has(candidate.id),
      hasAvailabilityCoverage: context.availableStaffIds.has(candidate.id),
      sameDayShifts: context.sameDayShifts,
      documentGate: context.documentGates.get(candidate.id) ?? emptyDocumentGate(),
      shift,
    });
  }

  private async loadShift(shiftId: string, db: DbLike = this.db): Promise<ShiftMatchingTarget> {
    const rows = await db
      .select({
        id: shifts.id,
        centreId: shifts.centreId,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
      })
      .from(shifts)
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
        status: staff.status,
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
      status: row.status,
      account: row.accountStatus
        ? {
            status: row.accountStatus,
            onboardingCompletedAt: row.onboardingCompletedAt,
          }
        : null,
    }));

    const staffIds = candidates.map((row) => row.id);

    const [banned, top, contacted, availableStaffIds, sameDayShifts, documentGates] =
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
        this.loadDocumentGates(db, staffIds),
      ]);

    return {
      candidates,
      bannedStaffIds: new Set(banned.map((row) => row.staffId)),
      topStaffIds: new Set(top.map((row) => row.staffId)),
      contactedStaffIds: new Set(contacted.map((row) => row.staffId)),
      availableStaffIds,
      sameDayShifts,
      documentGates,
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

  private async loadDocumentGates(
    db: DbLike,
    staffIds: string[],
  ): Promise<Map<string, StaffShiftDocumentGate>> {
    const gates = new Map<string, StaffShiftDocumentGate>();
    if (staffIds.length === 0) return gates;

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
      gates.set(staffId, deriveStaffShiftDocumentGate(inputs));
    }

    return gates;
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
};

function emptyDocumentGate(): StaffShiftDocumentGate {
  return deriveStaffShiftDocumentGate([]);
}
