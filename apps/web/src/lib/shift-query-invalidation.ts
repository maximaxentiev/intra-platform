import type { QueryClient } from "@tanstack/react-query";

export function invalidateShiftOperationalQueries(
  qc: QueryClient,
  shiftId: string,
  batchId?: string | null,
) {
  void qc.invalidateQueries({ queryKey: ["shift", shiftId] });
  void qc.invalidateQueries({ queryKey: ["shift-available", shiftId] });
  void qc.invalidateQueries({ queryKey: ["shift-comments", shiftId] });
  if (batchId) {
    void qc.invalidateQueries({ queryKey: ["shift-batch", batchId] });
    void qc.invalidateQueries({ queryKey: ["shift-batch-completion-readiness", batchId] });
  }
  void qc.invalidateQueries({ queryKey: ["shifts-feed"] });
}
