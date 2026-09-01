import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BatchDraftShiftRow } from "@/components/shifts/BatchDraftShiftRow";
import { Button } from "@/components/ui/button";
import {
  batchDraftRowHasContent,
  createEmptyBatchDraftShift,
  duplicateBatchDraftShift,
  formatBatchTimeForApi,
  parseBulkCreateError,
  validateBatchDraftRows,
  type BatchDraftFieldErrors,
  type BatchDraftShift,
} from "@/lib/batch-shift-ui";
import { shiftBatchesApi } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { invalidateShiftOperationalQueries } from "@/lib/shift-query-invalidation";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  batchId: string;
  centreName: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function BatchAddShiftsPanel({ batchId, centreName, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<BatchDraftShift[]>(() => [createEmptyBatchDraftShift()]);
  const [rowErrors, setRowErrors] = useState<BatchDraftFieldErrors[]>(() => [{}]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasContent = useMemo(() => rows.some(batchDraftRowHasContent), [rows]);

  function updateRow(index: number, next: BatchDraftShift) {
    setRows((prev) => prev.map((row, i) => (i === index ? next : row)));
    setRowErrors((prev) => prev.map((errors, i) => (i === index ? {} : errors)));
    setFormError(null);
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyBatchDraftShift()]);
    setRowErrors((prev) => [...prev, {}]);
  }

  function duplicateRow(index: number) {
    const source = rows[index];
    if (!source) return;
    setRows((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, duplicateBatchDraftShift(source));
      return next;
    });
    setRowErrors((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, {});
      return next;
    });
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setRowErrors((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (submitting) return;
    const validation = validateBatchDraftRows("locked", rows);
    setRowErrors(validation.rowErrors);
    if (validation.rowErrors.some((errors) => Object.keys(errors).length > 0)) {
      setFormError("Fix the highlighted shift rows before adding.");
      return;
    }
    if (!hasContent) {
      setFormError("Add at least one shift.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await shiftBatchesApi.bulkAddShifts(
        batchId,
        rows.map((row) => ({
          shiftDate: row.shiftDate,
          startTime: formatBatchTimeForApi(row.startTime),
          endTime: formatBatchTimeForApi(row.endTime),
          roleNeeded: row.roleNeeded,
          addedToStaffpoint: row.addedToStaffpoint,
          confirmationNotes: row.confirmationNotes.trim() || undefined,
          internalComment: row.internalComment.trim() || undefined,
        })),
      );
      toast.success("Shifts added to batch");
      invalidateShiftOperationalQueries(qc, "", batchId);
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const { index, detail } = parseBulkCreateError(err.details);
        if (index != null) {
          setRowErrors((prev) =>
            prev.map((errors, i) =>
              i === index ? { ...errors, shiftDate: detail ?? err.message } : errors,
            ),
          );
          setFormError(`Shift ${index + 1}: ${detail ?? err.message}`);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError(err instanceof Error ? err.message : "Could not add shifts");
      }
      toast.error("Could not add shifts to batch");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        New shifts will be added to the batch for <span className="font-medium text-foreground">{centreName}</span>.
        The Centre is locked to this batch.
      </p>

      <div className="max-h-[min(70vh,640px)] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
        {rows.map((row, index) => (
          <BatchDraftShiftRow
            key={row.key}
            index={index}
            row={row}
            errors={rowErrors[index] ?? {}}
            onChange={(next) => updateRow(index, next)}
            onDuplicate={() => duplicateRow(index)}
            onRemove={() => removeRow(index)}
            canRemove={rows.length > 1}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={addRow}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Add shift
        </Button>
      </div>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
        <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" disabled={submitting || !hasContent} onClick={() => void submit()}>
          {submitting ? "Adding shifts…" : "Add shifts to batch"}
        </Button>
      </div>
    </div>
  );
}
