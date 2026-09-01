import { ChevronDown, Copy, Info, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDestructiveDialog } from "@/components/ui-kit";
import { ShiftNotesField } from "@/components/shifts/ShiftNotesField";
import {
  type BatchDraftFieldErrors,
  type BatchDraftShift,
  INTERNAL_COMMENT_MAX_LENGTH,
} from "@/lib/batch-shift-ui";
import { NEW_SHIFT_ROLE_OPTIONS } from "@/lib/shift-role-ui";
import { cn } from "@/lib/utils";

const STAFFPOINT_HELP =
  "Whether this shift has also been posted to Staffpoint, the external staffing marketplace.";

const draftFieldClass =
  "border-border/70 bg-white text-foreground focus-visible:border-primary/30 focus-visible:ring-primary/20";

const draftLabelClass = "flex min-h-5 items-center gap-1.5 leading-none";

function DraftField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor} className={typeof label === "string" ? draftLabelClass : draftLabelClass}>
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function BatchDraftShiftRow({
  index,
  row,
  errors,
  onChange,
  onDuplicate,
  onRemove,
  canRemove,
}: {
  index: number;
  row: BatchDraftShift;
  errors: BatchDraftFieldErrors;
  onChange: (next: BatchDraftShift) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const set = <K extends keyof BatchDraftShift>(key: K, value: BatchDraftShift[K]) =>
    onChange({ ...row, [key]: value });

  return (
    <div
      className="rounded-lg border border-primary/15 bg-primary-soft/50 p-3 shadow-xs"
      data-testid={`batch-draft-row-${index}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Shift {index + 1}
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onDuplicate}>
            <Copy className="mr-1 h-3.5 w-3.5" aria-hidden />
            Duplicate
          </Button>
          {canRemove ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setRemoveOpen(true)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                Remove
              </Button>
              <ConfirmDestructiveDialog
                open={removeOpen}
                onOpenChange={setRemoveOpen}
                title="Remove this shift?"
                consequence="This shift will be removed from the current Batch draft."
                cancelLabel="Keep shift"
                confirmLabel="Remove shift"
                onConfirm={() => {
                  onRemove();
                  setRemoveOpen(false);
                }}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <DraftField label="Date *" htmlFor={`batch-date-${row.key}`} error={errors.shiftDate}>
          <Input
            id={`batch-date-${row.key}`}
            type="date"
            className={draftFieldClass}
            value={row.shiftDate}
            onChange={(e) => set("shiftDate", e.target.value)}
            aria-invalid={!!errors.shiftDate}
          />
        </DraftField>

        <DraftField label="Start *" htmlFor={`batch-start-${row.key}`} error={errors.startTime}>
          <Input
            id={`batch-start-${row.key}`}
            type="time"
            className={draftFieldClass}
            value={row.startTime}
            onChange={(e) => set("startTime", e.target.value)}
            aria-invalid={!!errors.startTime}
          />
        </DraftField>

        <DraftField label="End *" htmlFor={`batch-end-${row.key}`} error={errors.endTime}>
          <Input
            id={`batch-end-${row.key}`}
            type="time"
            className={draftFieldClass}
            value={row.endTime}
            onChange={(e) => set("endTime", e.target.value)}
            aria-invalid={!!errors.endTime}
          />
        </DraftField>

        <DraftField label="Role *" error={errors.roleNeeded}>
          <Select value={row.roleNeeded || undefined} onValueChange={(v) => set("roleNeeded", v)}>
            <SelectTrigger className={draftFieldClass} aria-label={`Role for shift ${index + 1}`}>
              <SelectValue placeholder="Choose role..." />
            </SelectTrigger>
            <SelectContent>
              {NEW_SHIFT_ROLE_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DraftField>

        <DraftField
          label={
            <>
              Staffpoint
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`About Staffpoint. ${STAFFPOINT_HELP}`}
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">{STAFFPOINT_HELP}</TooltipContent>
              </Tooltip>
            </>
          }
        >
          <Select
            value={row.addedToStaffpoint ? "yes" : "no"}
            onValueChange={(v) => set("addedToStaffpoint", v === "yes")}
          >
            <SelectTrigger className={draftFieldClass} aria-label={`Staffpoint for shift ${index + 1}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
            </SelectContent>
          </Select>
        </DraftField>

        <DraftField label="Notes">
          <Button
            type="button"
            variant="outline"
            className={cn("h-9 w-full justify-between", draftFieldClass)}
            aria-expanded={row.detailsOpen}
            aria-label={`Notes for shift ${index + 1}`}
            onClick={() => set("detailsOpen", !row.detailsOpen)}
          >
            <span>{row.detailsOpen ? "Hide notes" : "Add notes"}</span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", row.detailsOpen && "rotate-180")}
              aria-hidden
            />
          </Button>
        </DraftField>
      </div>

      {row.detailsOpen ? (
        <div className="mt-3 grid gap-4 border-t border-primary/15 pt-3 md:grid-cols-2">
          <ShiftNotesField
            id={`batch-notes-${row.key}`}
            value={row.confirmationNotes}
            onChange={(v) => set("confirmationNotes", v)}
            error={errors.confirmationNotes}
            compact
            inputClassName={draftFieldClass}
          />
          <div className="space-y-2">
            <Label htmlFor={`batch-internal-${row.key}`}>Internal Comment</Label>
            <Textarea
              id={`batch-internal-${row.key}`}
              value={row.internalComment}
              maxLength={INTERNAL_COMMENT_MAX_LENGTH}
              rows={2}
              placeholder="Optional"
              className={cn("min-h-[4.5rem] resize-y", draftFieldClass)}
              onChange={(e) => set("internalComment", e.target.value)}
            />
            {errors.internalComment ? (
              <p className="text-xs text-destructive">{errors.internalComment}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
