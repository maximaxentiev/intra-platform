import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BatchDraftShiftRow } from "@/components/shifts/BatchDraftShiftRow";
import { PageHeader } from "@/components/PageHeader";
import { BackLink, ConfirmDestructiveDialog, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableCentreSelect } from "@/components/SearchableCentreSelect";
import { ApiError } from "@/lib/api";
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

export const Route = createFileRoute("/_authenticated/shifts/batches/new")({
  component: NewBatchRequest,
});

function NewBatchRequest() {
  const navigate = useNavigate();
  const [centreId, setCentreId] = useState("");
  const [pendingCentreId, setPendingCentreId] = useState<string | null>(null);
  const [centreConfirmOpen, setCentreConfirmOpen] = useState(false);
  const [rows, setRows] = useState<BatchDraftShift[]>(() => [
    createEmptyBatchDraftShift(),
    createEmptyBatchDraftShift(),
  ]);
  const [rowErrors, setRowErrors] = useState<BatchDraftFieldErrors[]>(() => rows.map(() => ({})));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasDraftContent = useMemo(() => rows.some(batchDraftRowHasContent), [rows]);

  function updateRow(index: number, next: BatchDraftShift) {
    setRows((prev) => prev.map((row, i) => (i === index ? next : row)));
    setRowErrors((prev) => prev.map((errors, i) => (i === index ? {} : errors)));
    setFormError(null);
  }

  function handleCentreChange(nextCentreId: string) {
    if (!centreId || nextCentreId === centreId || !hasDraftContent) {
      setCentreId(nextCentreId);
      return;
    }
    setPendingCentreId(nextCentreId);
    setCentreConfirmOpen(true);
  }

  function confirmCentreChange() {
    if (pendingCentreId) setCentreId(pendingCentreId);
    setPendingCentreId(null);
    setCentreConfirmOpen(false);
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const validation = validateBatchDraftRows(centreId, rows);
    setRowErrors(validation.rowErrors);
    setFormError(validation.formError ?? null);
    if (validation.formError || validation.rowErrors.some((errors) => Object.keys(errors).length > 0)) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await shiftBatchesApi.createWithShifts({
        centreId,
        shifts: rows.map((row) => ({
          shiftDate: row.shiftDate,
          startTime: formatBatchTimeForApi(row.startTime),
          endTime: formatBatchTimeForApi(row.endTime),
          roleNeeded: row.roleNeeded,
          addedToStaffpoint: row.addedToStaffpoint,
          confirmationNotes: row.confirmationNotes.trim() || undefined,
          internalComment: row.internalComment.trim() || undefined,
        })),
      });
      toast.success("Batch request created");
      navigate({ to: "/shifts/batches/$id", params: { id: result.batch.id } });
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
        setFormError(err instanceof Error ? err.message : "Create failed");
      }
      toast.error("Could not create batch request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1200px] space-y-6">
      <BackLink to="/shifts" label="Back to Shifts" />
      <PageHeader
        title="Create Batch Request"
        subtitle="Enter multiple Shift requests for one Centre. Each row becomes a child Shift in the batch."
      />

      <form onSubmit={(e) => void submit(e)} className="space-y-6">
        <SectionCard id="batch-centre">
          <div className="space-y-2">
            <Label>Centre *</Label>
            <SearchableCentreSelect value={centreId} onChange={handleCentreChange} />
            <p className="text-xs text-muted-foreground">
              Selected once for the whole batch. Changing centre after entering shifts requires confirmation.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          id="batch-shifts"
          title="Shift drafts"
          action={
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Add shift
            </Button>
          }
        >
          <div className="hidden md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-3 md:px-3 md:pb-2 md:text-xs md:font-medium md:uppercase md:tracking-wide md:text-muted-foreground sticky top-0 z-10 bg-card">
            <span>Date</span>
            <span>Start</span>
            <span>End</span>
            <span>Role</span>
            <span>Staffpoint</span>
            <span className="text-right">More</span>
          </div>

          <div className="space-y-3">
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
        </SectionCard>

        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Batch Request"}
        </Button>
      </form>

      <ConfirmDestructiveDialog
        open={centreConfirmOpen}
        onOpenChange={setCentreConfirmOpen}
        title="Change centre?"
        consequence="Draft shifts were entered for the current centre. Changing centre may invalidate those assumptions."
        confirmLabel="Change centre"
        onConfirm={confirmCentreChange}
      />
    </div>
  );
}
