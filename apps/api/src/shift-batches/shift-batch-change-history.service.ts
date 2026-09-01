import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { platformAuditEvents, shifts, staff } from '../db/schema';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { resolveBatchFinalCarerLegalName } from './shift-batch-confirmation-final-email.template';
import { fmtTimeLabel } from './shift-batch-completion.util';
import type { BatchUpdateChangeItem, BatchUpdateChangeType } from './shift-batch-completion.types';

type FieldChange = {
  field: string;
  before: unknown;
  after: unknown;
};

const MATERIAL_SHIFT_ACTIONS = new Set<string>([
  PLATFORM_AUDIT_ACTIONS.shiftUpdated,
  PLATFORM_AUDIT_ACTIONS.shiftAssigned,
  PLATFORM_AUDIT_ACTIONS.shiftUnassigned,
  PLATFORM_AUDIT_ACTIONS.shiftReassigned,
  PLATFORM_AUDIT_ACTIONS.shiftCancelled,
  PLATFORM_AUDIT_ACTIONS.shiftStaffUnassignedScheduleChange,
]);

const ASSIGNMENT_ACTIONS = [
  PLATFORM_AUDIT_ACTIONS.shiftAssigned,
  PLATFORM_AUDIT_ACTIONS.shiftReassigned,
  PLATFORM_AUDIT_ACTIONS.shiftUnassigned,
  PLATFORM_AUDIT_ACTIONS.shiftStaffUnassignedScheduleChange,
] as const;

const UNASSIGN_ACTIONS = new Set<string>([
  PLATFORM_AUDIT_ACTIONS.shiftUnassigned,
  PLATFORM_AUDIT_ACTIONS.shiftStaffUnassignedScheduleChange,
]);

@Injectable()
export class ShiftBatchChangeHistoryService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getDetectedChanges(params: {
    batchId: string;
    since: Date | null;
  }): Promise<BatchUpdateChangeItem[]> {
    const childRows = await this.db
      .select({
        id: shifts.id,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
        shiftConfirmationNotes: shifts.shiftConfirmationNotes,
      })
      .from(shifts)
      .where(eq(shifts.batchId, params.batchId));

    if (!childRows.length) return [];

    const childIds = childRows.map((row) => row.id);
    const staffNameById = await this.loadStaffNamesForBatch(childIds);

    const conditions = [
      inArray(platformAuditEvents.shiftId, childIds),
      inArray(platformAuditEvents.action, [...MATERIAL_SHIFT_ACTIONS]),
    ];
    if (params.since) {
      conditions.push(gte(platformAuditEvents.occurredAt, params.since));
    }

    const events = await this.db
      .select({
        id: platformAuditEvents.id,
        shiftId: platformAuditEvents.shiftId,
        action: platformAuditEvents.action,
        metadata: platformAuditEvents.metadata,
        occurredAt: platformAuditEvents.occurredAt,
      })
      .from(platformAuditEvents)
      .where(and(...conditions))
      .orderBy(asc(platformAuditEvents.occurredAt), asc(platformAuditEvents.id));

    const eventsByShift = new Map<string, typeof events>();
    for (const event of events) {
      if (!event.shiftId) continue;
      const bucket = eventsByShift.get(event.shiftId) ?? [];
      bucket.push(event);
      eventsByShift.set(event.shiftId, bucket);
    }

    const changes: BatchUpdateChangeItem[] = [];

    for (const child of childRows) {
      const shiftLabel = formatShiftLabel(String(child.shiftDate), child.startTime, child.endTime);
      const shiftEvents = eventsByShift.get(child.id) ?? [];

      if (child.status === 'cancelled') {
        const cancelled = shiftEvents.some(
          (event) => event.action === PLATFORM_AUDIT_ACTIONS.shiftCancelled,
        );
        if (cancelled || shiftEvents.length > 0) {
          changes.push(
            buildChangeItem({
              id: `${child.id}:cancelled`,
              shiftId: child.id,
              shiftLabel,
              type: 'shift_cancelled',
              label: 'Shift cancelled',
            }),
          );
        }
        continue;
      }

      const baselineAssigneeId = await this.resolveAssigneeAt(child.id, params.since);
      const currentAssigneeId = child.assignedStaffId;
      if (baselineAssigneeId !== currentAssigneeId) {
        const previousName = formatCarerName(baselineAssigneeId, staffNameById);
        const currentName = formatCarerName(currentAssigneeId, staffNameById);
        changes.push(
          buildChangeItem({
            id: `${child.id}:carer`,
            shiftId: child.id,
            shiftLabel,
            type: 'carer_changed',
            label: `Carer changed from ${previousName} to ${currentName}`,
            previousValue: previousName,
            currentValue: currentName,
          }),
        );
      }

      const fieldChanges = this.coalesceFieldChanges(shiftEvents, child);
      changes.push(...fieldChanges.map((item) => ({ ...item, shiftLabel })));
    }

    return changes;
  }

  private async resolveAssigneeAt(shiftId: string, at: Date | null): Promise<string | null> {
    const conditions = [
      eq(platformAuditEvents.shiftId, shiftId),
      inArray(platformAuditEvents.action, [...ASSIGNMENT_ACTIONS]),
    ];
    if (at) {
      conditions.push(lte(platformAuditEvents.occurredAt, at));
    }

    const events = await this.db
      .select({
        action: platformAuditEvents.action,
        metadata: platformAuditEvents.metadata,
        occurredAt: platformAuditEvents.occurredAt,
        id: platformAuditEvents.id,
      })
      .from(platformAuditEvents)
      .where(and(...conditions))
      .orderBy(asc(platformAuditEvents.occurredAt), asc(platformAuditEvents.id));

    let assigneeId: string | null = null;
    for (const event of events) {
      const metadata = (event.metadata ?? {}) as Record<string, unknown>;
      if (UNASSIGN_ACTIONS.has(event.action)) {
        assigneeId = null;
        continue;
      }
      const nextId =
        (metadata.newStaffId as string | undefined) ??
        (metadata.assignedStaffId as string | undefined);
      if (nextId) {
        assigneeId = nextId;
      }
    }

    return assigneeId;
  }

  private coalesceFieldChanges(
    shiftEvents: Array<{
      action: string;
      metadata: unknown;
    }>,
    child: {
      id: string;
      shiftDate: string | Date;
      startTime: string;
      endTime: string;
      roleNeeded: string | null;
      shiftConfirmationNotes: string | null;
    },
  ): BatchUpdateChangeItem[] {
    const coalesced = new Map<
      string,
      | { type: BatchUpdateChangeType; firstBefore?: string; lastAfter?: string }
      | {
          type: 'time_changed';
          startBefore?: string;
          endBefore?: string;
          startAfter?: string;
          endAfter?: string;
        }
    >();

    for (const event of shiftEvents) {
      if (event.action !== PLATFORM_AUDIT_ACTIONS.shiftUpdated) continue;
      const metadata = (event.metadata ?? {}) as Record<string, unknown>;
      const fieldChanges = extractFieldChangesFromAuditMetadata(metadata);
      for (const change of fieldChanges) {
        if (change.field === 'notes' || change.field === 'addedToStaffpoint') continue;

        if (change.field === 'confirmationNotes') {
          coalesced.set('confirmationNotes', { type: 'shift_notes_updated' });
          continue;
        }

        if (change.field === 'shiftDate') {
          const before = formatFieldValue('shiftDate', change.before);
          const after = formatFieldValue('shiftDate', change.after);
          const existing = coalesced.get('shiftDate');
          const priorFirstBefore =
            existing && 'firstBefore' in existing ? existing.firstBefore : undefined;
          coalesced.set('shiftDate', {
            type: 'date_changed',
            firstBefore: priorFirstBefore ?? before,
            lastAfter: after,
          });
          continue;
        }

        if (change.field === 'startTime' || change.field === 'endTime') {
          let schedule = coalesced.get('schedule') as
            | {
                type: 'time_changed';
                startBefore?: string;
                endBefore?: string;
                startAfter?: string;
                endAfter?: string;
              }
            | undefined;

          if (!schedule) {
            schedule = {
              type: 'time_changed',
              startBefore: formatFieldValue('startTime', child.startTime),
              endBefore: formatFieldValue('endTime', child.endTime),
              startAfter: formatFieldValue('startTime', child.startTime),
              endAfter: formatFieldValue('endTime', child.endTime),
            };
          }

          if (change.field === 'startTime') {
            if (schedule.startBefore === formatFieldValue('startTime', child.startTime)) {
              schedule.startBefore = formatFieldValue('startTime', change.before);
            }
            schedule.startAfter = formatFieldValue('startTime', change.after);
          } else {
            if (schedule.endBefore === formatFieldValue('endTime', child.endTime)) {
              schedule.endBefore = formatFieldValue('endTime', change.before);
            }
            schedule.endAfter = formatFieldValue('endTime', change.after);
          }

          coalesced.set('schedule', schedule);
          continue;
        }

        if (change.field === 'roleNeeded') {
          const before = formatFieldValue('roleNeeded', change.before);
          const after = formatFieldValue('roleNeeded', change.after);
          const existing = coalesced.get('roleNeeded');
          const priorFirstBefore =
            existing && 'firstBefore' in existing ? existing.firstBefore : undefined;
          coalesced.set('roleNeeded', {
            type: 'role_changed',
            firstBefore: priorFirstBefore ?? before,
            lastAfter: after,
          });
        }
      }
    }

    const items: BatchUpdateChangeItem[] = [];
    for (const [fieldKey, item] of coalesced.entries()) {
      if (item.type === 'shift_notes_updated') {
        items.push(
          buildChangeItem({
            id: `${child.id}:confirmationNotes`,
            shiftId: child.id,
            shiftLabel: '',
            type: 'shift_notes_updated',
            label: 'Shift Notes updated',
          }),
        );
        continue;
      }

      if (item.type === 'time_changed') {
        const schedule = item as {
          startBefore?: string;
          endBefore?: string;
          startAfter?: string;
          endAfter?: string;
        };
        const firstBefore = `${schedule.startBefore ?? '—'}–${schedule.endBefore ?? '—'}`;
        const lastAfter = `${schedule.startAfter ?? '—'}–${schedule.endAfter ?? '—'}`;
        if (firstBefore === lastAfter) continue;
        items.push(
          buildChangeItem({
            id: `${child.id}:schedule`,
            shiftId: child.id,
            shiftLabel: '',
            type: 'time_changed',
            label: `Time changed from ${firstBefore} to ${lastAfter}`,
            previousValue: firstBefore,
            currentValue: lastAfter,
          }),
        );
        continue;
      }

      if (!('firstBefore' in item)) continue;
      if (!item.firstBefore || !item.lastAfter || item.firstBefore === item.lastAfter) continue;

      const label =
        item.type === 'date_changed'
          ? `Date changed from ${item.firstBefore} to ${item.lastAfter}`
          : item.type === 'role_changed'
            ? `Role changed from ${item.firstBefore} to ${item.lastAfter}`
            : `${fieldKey} changed from ${item.firstBefore} to ${item.lastAfter}`;

      items.push(
        buildChangeItem({
          id: `${child.id}:${fieldKey}`,
          shiftId: child.id,
          shiftLabel: '',
          type: item.type,
          label,
          previousValue: item.firstBefore,
          currentValue: item.lastAfter,
        }),
      );
    }

    return items;
  }

  private async loadStaffNamesForBatch(childIds: string[]) {
    const assignmentEvents = await this.db
      .select({ metadata: platformAuditEvents.metadata })
      .from(platformAuditEvents)
      .where(
        and(
          inArray(platformAuditEvents.shiftId, childIds),
          inArray(platformAuditEvents.action, [...ASSIGNMENT_ACTIONS]),
        ),
      );

    const staffIds = new Set<string>();
    for (const event of assignmentEvents) {
      const metadata = (event.metadata ?? {}) as Record<string, unknown>;
      for (const key of ['previousStaffId', 'newStaffId', 'assignedStaffId'] as const) {
        const value = metadata[key];
        if (typeof value === 'string' && value) staffIds.add(value);
      }
    }

    const currentRows = await this.db
      .select({ assignedStaffId: shifts.assignedStaffId })
      .from(shifts)
      .where(inArray(shifts.id, childIds));
    for (const row of currentRows) {
      if (row.assignedStaffId) staffIds.add(row.assignedStaffId);
    }

    if (!staffIds.size) return new Map<string, string>();

    const rows = await this.db
      .select({
        id: staff.id,
        legalName: staff.legalName,
        legalFirstName: staff.legalFirstName,
        legalLastName: staff.legalLastName,
        displayName: staff.displayName,
        useDisplayName: staff.useDisplayName,
      })
      .from(staff)
      .where(inArray(staff.id, [...staffIds]));

    return new Map(
      rows.map((row) => [
        row.id,
        resolveBatchFinalCarerLegalName({
          legalName: row.legalName,
          legalFirstName: row.legalFirstName,
          legalLastName: row.legalLastName,
          displayName: row.displayName,
          useDisplayName: row.useDisplayName,
        }),
      ]),
    );
  }
}

function buildChangeItem(input: {
  id: string;
  shiftId: string;
  shiftLabel: string;
  type: BatchUpdateChangeType;
  label: string;
  previousValue?: string | null;
  currentValue?: string | null;
}): BatchUpdateChangeItem {
  const summary = input.shiftLabel ? `${input.shiftLabel}: ${input.label}` : input.label;
  return {
    id: input.id,
    shiftId: input.shiftId,
    shiftLabel: input.shiftLabel,
    type: input.type,
    label: input.label,
    summary,
    previousValue: input.previousValue ?? null,
    currentValue: input.currentValue ?? null,
    defaultSelected: true,
  };
}

function formatCarerName(staffId: string | null | undefined, staffNameById: Map<string, string>) {
  if (!staffId) return 'unassigned';
  return staffNameById.get(staffId) ?? 'Unknown Carer';
}

function extractFieldChangesFromAuditMetadata(
  metadata: Record<string, unknown>,
): Array<{ field: string; before: unknown; after: unknown }> {
  const raw = metadata.changes;
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        const change = entry as FieldChange;
        if (!change?.field) return null;
        return { field: String(change.field), before: change.before, after: change.after };
      })
      .filter((entry): entry is { field: string; before: unknown; after: unknown } => entry != null);
  }

  if (typeof raw === 'object') {
    return Object.entries(
      raw as Record<string, { from?: unknown; to?: unknown; before?: unknown; after?: unknown }>,
    ).map(([field, value]) => ({
      field,
      before: value.before ?? value.from,
      after: value.after ?? value.to,
    }));
  }

  return [];
}

function formatShiftLabel(shiftDate: string, startTime: string, endTime: string): string {
  return `${shiftDate} · ${fmtTimeLabel(startTime)}–${fmtTimeLabel(endTime)}`;
}

function formatFieldValue(field: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (field === 'startTime' || field === 'endTime') return fmtTimeLabel(String(value));
  return String(value);
}
