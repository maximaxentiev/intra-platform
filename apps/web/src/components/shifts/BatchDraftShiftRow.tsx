import { ChevronDown, Copy, Trash2 } from "lucide-react";
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
import { Info } from "lucide-react";

const STAFFPOINT_HELP =
  "Whether this shift has also been posted to Staffpoint, the external staffing marketplace.";

const draftFieldClass =
  "border-primary/15 bg-primary-soft text-foreground focus-visible:border-primary/30 focus-visible:ring-primary/20";

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
      <div className="mb-2 flex items-center justify-between gap-2">
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

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`batch-date-${row.key}`}>Date *</Label>
          <Input
            id={`batch-date-${row.key}`}
            type="date"
            className={draftFieldClass}
            value={row.shiftDate}
            onChange={(e) => set("shiftDate", e.target.value)}
            aria-invalid={!!errors.shiftDate}
          />
          {errors.shiftDate ? <p className="text-xs text-destructive">{errors.shiftDate}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`batch-start-${row.key}`}>Start *</Label>
          <Input
            id={`batch-start-${row.key}`}
            type="time"
            className={draftFieldClass}
            value={row.startTime}
            onChange={(e) => set("startTime", e.target.value)}
            aria-invalid={!!errors.startTime}
          />
          {errors.startTime ? <p className="text-xs text-destructive">{errors.startTime}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`batch-end-${row.key}`}>End *</Label>
          <Input
            id={`batch-end-${row.key}`}
            type="time"
            className={draftFieldClass}
            value={row.endTime}
            onChange={(e) => set("endTime", e.target.value)}
            aria-invalid={!!errors.endTime}
          />
          {errors.endTime ? <p className="text-xs text-destructive">{errors.endTime}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label>Role *</Label>
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
          {errors.roleNeeded ? <p className="text-xs text-destructive">{errors.roleNeeded}</p> : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label>Staffpoint</Label>
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
          </div>
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
        </div>

        <div className="space-y-1.5 md:space-y-0">
          <Label className="sr-only md:not-sr-only md:mb-1.5 md:block md:opacity-0">Notes</Label>
          <Button
            type="button"
            variant="outline"
            className={cn("h-9 w-full border-primary/15 bg-primary-soft md:w-auto", draftFieldClass)}
            aria-expanded={row.detailsOpen}
            onClick={() => set("detailsOpen", !row.detailsOpen)}
          >
            Notes
            <ChevronDown
              className={cn("ml-1.5 h-4 w-4 transition-transform", row.detailsOpen && "rotate-180")}
              aria-hidden
            />
          </Button>
        </div>
      </div>

      {row.detailsOpen ? (
        <div className="mt-3 grid gap-4 border-t border-primary/15 pt-3 md:grid-cols-2">
          <ShiftNotesField
            id={`batch-notes-${row.key}`}
            value={row.confirmationNotes}
            onChange={(v) => set("confirmationNotes", v)}
            error={errors.confirmationNotes}
            compact
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
