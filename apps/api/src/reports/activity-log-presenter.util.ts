import type {
  ActivityLogActor,
  ActivityLogItem,
  ActivityLogRawRow,
} from './types/activity-log.types';
import { communicationTypeLabel } from './activity-log-portal-map.util';

function staffDisplayName(input: {
  legalName: string;
  displayName: string;
  useDisplayName: boolean;
}): string {
  return input.useDisplayName && input.displayName.trim()
    ? input.displayName.trim()
    : input.legalName;
}

export function presentActivityLogItem(
  row: ActivityLogRawRow,
  names: {
    staff: Map<string, { legalName: string; displayName: string; useDisplayName: boolean }>;
    centres: Map<string, string>;
    users: Map<string, string>;
    shifts: Map<string, string>;
  },
): ActivityLogItem {
  const occurredAt =
    row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at);
  const metadata = row.metadata ?? undefined;

  const staffRow = row.staff_id ? names.staff.get(row.staff_id) : undefined;
  const staffRef =
    row.staff_id && staffRow
      ? { id: row.staff_id, name: staffDisplayName(staffRow) }
      : undefined;

  const centreRef =
    row.centre_id && names.centres.has(row.centre_id)
      ? { id: row.centre_id, name: names.centres.get(row.centre_id)! }
      : undefined;

  const shiftRef =
    row.shift_id && names.shifts.has(row.shift_id)
      ? { id: row.shift_id, shiftDate: names.shifts.get(row.shift_id)! }
      : undefined;

  const actor: ActivityLogActor = {
    type: row.actor_type,
    id: row.actor_user_id,
    name: resolveActorName(row, names),
  };

  const { title, description } = buildCopy(row, {
    staffName: staffRef?.name,
    centreName: centreRef?.name,
    shiftDate: shiftRef?.shiftDate,
    metadata,
  });

  return {
    id: row.source_key,
    occurredAt,
    category: row.category,
    action: row.action,
    title,
    description,
    actor,
    staff: staffRef,
    centre: centreRef,
    shift: shiftRef,
    metadata: sanitizeReportMetadata(metadata),
  };
}

function resolveActorName(
  row: ActivityLogRawRow,
  names: { users: Map<string, string> },
): string | null {
  if (row.actor_type === 'system') return 'System';
  if (row.actor_type === 'unknown') return 'Unknown';
  if (row.actor_user_id && names.users.has(row.actor_user_id)) {
    return names.users.get(row.actor_user_id)!;
  }
  if (row.actor_type === 'staff') return 'Staff member';
  return null;
}

function buildCopy(
  row: ActivityLogRawRow,
  ctx: {
    staffName?: string;
    centreName?: string;
    shiftDate?: string;
    metadata?: Record<string, unknown>;
  },
): { title: string; description: string | null } {
  const action = row.action;

  if (action === 'shift_created') {
    return { title: 'Shift created', description: centreLabel(ctx) };
  }
  if (action === 'shift_updated') {
    return { title: 'Shift updated', description: describeChanges(ctx.metadata) };
  }
  if (action === 'shift_assigned') {
    return { title: 'Shift assigned', description: staffCentreShiftSentence(ctx) };
  }
  if (action === 'shift_reassigned') {
    return { title: 'Shift reassigned', description: staffCentreShiftSentence(ctx) };
  }
  if (action === 'shift_unassigned') {
    return { title: 'Shift unassigned', description: centreLabel(ctx) };
  }
  if (action === 'shift_cancelled') {
    return { title: 'Shift cancelled', description: centreLabel(ctx) };
  }
  if (action === 'shift_completed_manual') {
    return { title: 'Shift completed', description: staffCentreShiftSentence(ctx) };
  }
  if (action === 'shift_completed_auto') {
    return {
      title: 'Shift auto-completed',
      description: staffCentreShiftSentence(ctx) ?? 'System marked the shift completed.',
    };
  }
  if (action === 'shift_record_created') {
    return { title: 'Shift record created', description: centreLabel(ctx) };
  }
  if (action === 'assignment_confirmation_sent' || action === 'assignment_confirmation_failed') {
    const label = action.endsWith('sent') ? 'sent' : 'failed';
    return {
      title: `Assignment confirmation ${label}`,
      description: staffCentreShiftSentence(ctx),
    };
  }
  if (action === 'communication_sent' || action === 'communication_failed') {
    const commType =
      typeof ctx.metadata?.communicationType === 'string'
        ? ctx.metadata.communicationType
        : 'communication';
    const label = communicationTypeLabel(commType);
    const verb = action === 'communication_sent' ? 'sent' : 'failed';
    return {
      title: `Reminder ${verb}`,
      description: ctx.staffName ? `${label} ${verb} to ${ctx.staffName}` : `${label} ${verb}`,
    };
  }
  if (action === 'staff_portal_event') {
    const eventType =
      typeof ctx.metadata?.eventType === 'string' ? ctx.metadata.eventType : 'activity';
    return { title: humanizeAction(eventType), description: ctx.staffName ?? null };
  }

  return { title: humanizeAction(action), description: ctx.staffName ?? ctx.centreName ?? null };
}

function humanizeAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function centreLabel(ctx: {
  centreName?: string;
  shiftDate?: string;
  metadata?: Record<string, unknown>;
}): string | null {
  const date =
    ctx.shiftDate ??
    (typeof ctx.metadata?.shiftDate === 'string' ? ctx.metadata.shiftDate : undefined);
  if (ctx.centreName && date) return `${ctx.centreName} on ${date}`;
  if (ctx.centreName) return ctx.centreName;
  if (date) return `Shift on ${date}`;
  return null;
}

function staffCentreShiftSentence(ctx: {
  staffName?: string;
  centreName?: string;
  shiftDate?: string;
}): string | null {
  if (ctx.staffName && ctx.centreName && ctx.shiftDate) {
    return `${ctx.staffName} at ${ctx.centreName} on ${ctx.shiftDate}`;
  }
  if (ctx.staffName && ctx.shiftDate) return `${ctx.staffName} on ${ctx.shiftDate}`;
  return centreLabel(ctx);
}

function describeChanges(metadata?: Record<string, unknown>): string | null {
  const changes = metadata?.changes;
  if (!changes || typeof changes !== 'object') return null;
  const parts: string[] = [];
  for (const [field, value] of Object.entries(
    changes as Record<string, { from?: unknown; to?: unknown }>,
  )) {
    if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
      parts.push(`${field} changed`);
    }
  }
  return parts.length ? parts.join('; ') : null;
}

function sanitizeReportMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/token|password|secret|hash|storage|provider|url/i.test(key)) continue;
    if (['changes', 'communicationType', 'eventType', 'cancellationReasonPreview'].includes(key)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
