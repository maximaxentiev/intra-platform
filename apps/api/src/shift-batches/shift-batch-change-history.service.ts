import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { platformAuditEvents, shifts } from '../db/schema';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { fmtTimeLabel } from './shift-batch-completion.util';
import type { BatchUpdateChangeItem } from './shift-batch-completion.types';

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

const FIELD_LABELS: Record<string, string> = {
  shiftDate: 'Date',
  startTime: 'Start time',
  endTime: 'End time',
  roleNeeded: 'Role',
  confirmationNotes: 'Shift Notes',
};

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
      })
      .from(shifts)
      .where(eq(shifts.batchId, params.batchId));

    if (!childRows.length) return [];

    const childIds = childRows.map((row) => row.id);
    const childById = new Map(childRows.map((row) => [row.id, row]));

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
      })
      .from(platformAuditEvents)
      .where(and(...conditions))
      .orderBy(asc(platformAuditEvents.occurredAt), asc(platformAuditEvents.id));

    const coalesced = new Map<string, { shiftId: string; summary: string; firstBefore?: string }>();

    for (const event of events) {
      if (!event.shiftId) continue;
      const shiftMeta = childById.get(event.shiftId);
      const shiftLabel = shiftMeta
        ? formatShiftLabel(String(shiftMeta.shiftDate), shiftMeta.startTime, shiftMeta.endTime)
        : 'Shift';

      if (event.action === PLATFORM_AUDIT_ACTIONS.shiftCancelled) {
        coalesced.set(`${event.shiftId}:cancelled`, {
          shiftId: event.shiftId,
          summary: `${shiftLabel}: Cancelled`,
        });
        continue;
      }

      if (
        event.action === PLATFORM_AUDIT_ACTIONS.shiftReassigned ||
        event.action === PLATFORM_AUDIT_ACTIONS.shiftAssigned ||
        event.action === PLATFORM_AUDIT_ACTIONS.shiftUnassigned ||
        event.action === PLATFORM_AUDIT_ACTIONS.shiftStaffUnassignedScheduleChange
      ) {
        const metadata = (event.metadata ?? {}) as Record<string, unknown>;
        const previousStaffId = metadata.previousStaffId as string | undefined;
        const newStaffId =
          (metadata.newStaffId as string | undefined) ??
          (metadata.assignedStaffId as string | undefined);
        const fromLabel = previousStaffId ? 'previous Carer' : 'unassigned';
        const toLabel = newStaffId ? 'new Carer' : 'unassigned';
        const key = `${event.shiftId}:carer`;
        const existing = coalesced.get(key);
        coalesced.set(key, {
          shiftId: event.shiftId,
          summary: `${shiftLabel}: Carer changed (${existing?.firstBefore ?? fromLabel} → ${toLabel})`,
          firstBefore: existing?.firstBefore ?? fromLabel,
        });
        continue;
      }

      const metadata = (event.metadata ?? {}) as Record<string, unknown>;
      const changes = metadata.changes as FieldChange[] | undefined;
      if (!changes?.length) continue;

      for (const change of changes) {
        if (change.field === 'notes' || change.field === 'addedToStaffpoint') continue;
        const fieldKey = change.field === 'confirmationNotes' ? 'confirmationNotes' : change.field;
        const label = FIELD_LABELS[fieldKey] ?? fieldKey;
        const key = `${event.shiftId}:${fieldKey}`;
        const before = formatFieldValue(fieldKey, change.before);
        const after = formatFieldValue(fieldKey, change.after);
        const existing = coalesced.get(key);
        coalesced.set(key, {
          shiftId: event.shiftId,
          summary: `${shiftLabel}: ${label} changed from ${existing?.firstBefore ?? before} to ${after}`,
          firstBefore: existing?.firstBefore ?? before,
        });
      }
    }

    return [...coalesced.entries()].map(([id, item]) => ({
      id,
      shiftId: item.shiftId,
      shiftLabel: childById.get(item.shiftId)
        ? formatShiftLabel(
            String(childById.get(item.shiftId)!.shiftDate),
            childById.get(item.shiftId)!.startTime,
            childById.get(item.shiftId)!.endTime,
          )
        : 'Shift',
      summary: item.summary,
      defaultSelected: true,
    }));
  }
}

function formatShiftLabel(shiftDate: string, startTime: string, endTime: string): string {
  return `${shiftDate} · ${fmtTimeLabel(startTime)}–${fmtTimeLabel(endTime)}`;
}

function formatFieldValue(field: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (field === 'startTime' || field === 'endTime') return fmtTimeLabel(String(value));
  return String(value);
}
