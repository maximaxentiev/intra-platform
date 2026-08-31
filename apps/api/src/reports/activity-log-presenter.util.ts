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
    const verb = action.endsWith('sent') ? 'sent' : 'failed';
    return {
      title: `Assignment confirmation ${verb}`,
      description: assignmentConfirmationDescription(ctx, verb),
    };
  }
  if (action === 'shift_update_communication_sent' || action === 'shift_update_communication_failed') {
    const verb = action.endsWith('sent') ? 'sent' : 'failed';
    const recipientType =
      typeof ctx.metadata?.recipientType === 'string' ? ctx.metadata.recipientType : 'recipient';
    const included = formatIncludedChanges(ctx.metadata?.includedChanges);
    const recipientLabel = recipientType === 'centre' ? 'Centre' : recipientType === 'carer' ? 'Carer' : 'Recipient';
    return {
      title: `Shift update ${verb} to ${recipientLabel}`,
      description: included ?? centreLabel(ctx),
    };
  }
  if (action === 'shift_availability_override_confirmed') {
    return {
      title: 'Availability override confirmed',
      description: ctx.staffName
        ? `${ctx.staffName} kept assigned after a schedule change outside submitted availability`
        : 'Assigned Staff kept after availability override',
    };
  }
  if (action === 'shift_staff_unassigned_schedule_change') {
    return {
      title: 'Staff unassigned after schedule change',
      description: ctx.staffName
        ? `${ctx.staffName} removed after the revised schedule was incompatible`
        : 'Assigned Staff removed after schedule change',
    };
  }
  if (action === 'batch_progress_email_scheduled') {
    const recipientEmail =
      typeof ctx.metadata?.recipientEmail === 'string' ? ctx.metadata.recipientEmail : null;
    return {
      title: 'Centre progress update scheduled',
      description: recipientEmail
        ? `Scheduled to ${recipientEmail}`
        : centreLabel(ctx),
    };
  }
  if (action === 'batch_progress_email_blocked') {
    const reason =
      typeof ctx.metadata?.failureReason === 'string' ? ctx.metadata.failureReason : null;
    return {
      title: 'Centre progress update could not be sent',
      description: reason ?? centreLabel(ctx),
    };
  }
  if (action === 'communication_sent' || action === 'communication_failed') {
    const commType =
      typeof ctx.metadata?.communicationType === 'string'
        ? ctx.metadata.communicationType
        : 'communication';
    const verb = action === 'communication_sent' ? 'sent' : 'failed';

    if (commType === 'shift_cancellation_centre' || commType === 'shift_cancellation_carer') {
      return {
        title: `Cancellation confirmation ${verb}`,
        description: cancellationConfirmationDescription(commType, ctx, verb),
      };
    }

    if (commType === 'batch_progress_70') {
      return {
        title: `Centre progress update ${verb}`,
        description: ctx.centreName
          ? `Progress update ${verb} to ${ctx.centreName}`
          : `Centre progress update ${verb}`,
      };
    }

    const label = communicationTypeLabel(commType);
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
  if (action === 'user_password_reset') {
    const targetName =
      typeof ctx.metadata?.name === 'string'
        ? ctx.metadata.name
        : (ctx.metadata?.email as string | undefined);
    return {
      title: 'Password reset',
      description: targetName ? `Temporary password generated for ${targetName}` : null,
    };
  }
  if (action === 'user_password_changed') {
    const targetName =
      typeof ctx.metadata?.name === 'string'
        ? ctx.metadata.name
        : (ctx.metadata?.email as string | undefined);
    const forced = ctx.metadata?.forced === true;
    return {
      title: 'Password changed',
      description: targetName
        ? forced
          ? `${targetName} replaced an administrator-issued temporary password`
          : `${targetName} changed their password`
        : null,
    };
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

function assignmentConfirmationDescription(
  ctx: {
    staffName?: string;
    centreName?: string;
    shiftDate?: string;
    metadata?: Record<string, unknown>;
  },
  verb: 'sent' | 'failed',
): string | null {
  const recipientType = ctx.metadata?.recipientType;
  if (recipientType === 'carer' && ctx.staffName) {
    return `Carer confirmation ${verb} to ${ctx.staffName}`;
  }
  if (recipientType === 'centre' && ctx.centreName) {
    return `Centre confirmation ${verb} to ${ctx.centreName}`;
  }
  return staffCentreShiftSentence(ctx);
}

function cancellationConfirmationDescription(
  commType: string,
  ctx: { staffName?: string; centreName?: string },
  verb: 'sent' | 'failed',
): string | null {
  if (commType === 'shift_cancellation_centre' && ctx.centreName) {
    return `Centre confirmation ${verb} to ${ctx.centreName}`;
  }
  if (commType === 'shift_cancellation_carer' && ctx.staffName) {
    return `Carer confirmation ${verb} to ${ctx.staffName}`;
  }
  return communicationTypeLabel(commType);
}

function formatIncludedChanges(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const labels: Record<string, string> = { date: 'Date', time: 'Time', role: 'Role required' };
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => labels[item] ?? item)
    .join(', ');
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
    if (
      ['changes', 'communicationType', 'eventType', 'cancellationReasonPreview', 'recipientType', 'includedChanges', 'deliveryMessageId'].includes(
        key,
      )
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
