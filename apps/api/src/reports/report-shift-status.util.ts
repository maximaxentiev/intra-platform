import type { CentreUsageShiftDetailStatus } from './dto/centre-usage-shifts-query.dto';

export type ReportShiftStatus = 'pending' | 'filled' | 'completed' | 'cancelled';

const SHIFT_STATUS_LABELS: Record<ReportShiftStatus, string> = {
  pending: 'Pending',
  filled: 'Filled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function formatReportShiftStatusLabel(status: ReportShiftStatus): string {
  return SHIFT_STATUS_LABELS[status];
}

export function resolveCentreUsageShiftDetailStatus(
  status: CentreUsageShiftDetailStatus | undefined,
): CentreUsageShiftDetailStatus {
  return status ?? 'completed';
}
