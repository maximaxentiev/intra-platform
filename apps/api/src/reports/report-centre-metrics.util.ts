import {
  computeCentreReportFillRateFromCombined,
  computeCentreReportFillRatePercent,
} from './report-percentage.util';

type StatusBucket = { count: number; minutes: number };

export type CentreReportStatusCountInput = {
  pending: StatusBucket;
  filled: StatusBucket;
  completed: StatusBucket;
  cancelled: StatusBucket;
};

export function buildCentreReportMetricsFromStatusCounts(input: CentreReportStatusCountInput) {
  const pending = input.pending.count;
  const filledStatusCount = input.filled.count;
  const completed = input.completed.count;
  const cancelled = input.cancelled.count;
  const filled = filledStatusCount + completed;
  const totalScheduledMinutes =
    input.pending.minutes +
    input.filled.minutes +
    input.completed.minutes +
    input.cancelled.minutes;
  const completedScheduledMinutes = input.completed.minutes;
  const cancelledScheduledMinutes = input.cancelled.minutes;
  const fillRatePercent = computeCentreReportFillRatePercent(
    filledStatusCount,
    completed,
    cancelled,
  );

  return {
    pending,
    filled,
    completed,
    cancelled,
    totalScheduledMinutes,
    completedScheduledMinutes,
    cancelledScheduledMinutes,
    fillRatePercent,
  };
}

export function combineCentreReportFilledMetric(
  filledStatusCount: number,
  completedStatusCount: number,
): number {
  return filledStatusCount + completedStatusCount;
}

export function summarizeCentreReportFillRate(
  combinedFilledTotal: number,
  cancelledTotal: number,
) {
  return computeCentreReportFillRateFromCombined(combinedFilledTotal, cancelledTotal);
}
