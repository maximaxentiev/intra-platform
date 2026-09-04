import { useEffect, useId, useState } from "react";
import { CentreEmailBodyEditor } from "@/components/shifts/CentreEmailBodyEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CentreEmailBodySegment, CentreEmailPreview, CentreEmailRecipient } from "@/lib/centre-email-review";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: CentreEmailPreview | null;
  previewLoading?: boolean;
  previewError?: string | null;
  subject: string;
  body: string;
  segments: CentreEmailBodySegment[];
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: { body: string; segments: CentreEmailBodySegment[] }) => void;
  submitting?: boolean;
  submitLabel?: string;
  staleError?: string | null;
  onBack?: () => void;
  onSubmit: () => void;
};

function formatRecipient(recipient: CentreEmailRecipient | null | undefined) {
  if (!recipient) return "No primary Centre contact configured";
  return `${recipient.name} · ${recipient.email}`;
}

export function CentreEmailReviewDialog({
  open,
  onOpenChange,
  preview,
  previewLoading = false,
  previewError,
  subject,
  body,
  segments,
  onSubjectChange,
  onBodyChange,
  submitting = false,
  submitLabel = "Send confirmation",
  staleError,
  onBack,
  onSubmit,
}: Props) {
  const subjectId = useId();
  const [subjectError, setSubjectError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSubjectError(null);
  }, [open]);

  function handleSubmit() {
    if (!subject.trim()) {
      setSubjectError("Subject is required.");
      return;
    }
    if (!body.trim()) {
      setSubjectError(null);
      return;
    }
    setSubjectError(null);
    onSubmit();
  }

  const busy = submitting || previewLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Centre Email</DialogTitle>
          <DialogDescription>
            Review and edit the Centre confirmation email before it is sent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm">
            <span className="font-medium text-foreground">To: </span>
            <span className="text-muted-foreground">{formatRecipient(preview?.recipient)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor={subjectId}>Subject</Label>
            <Input
              id={subjectId}
              value={subject}
              disabled={busy}
              maxLength={200}
              onChange={(event) => {
                onSubjectChange(event.target.value);
                if (subjectError && event.target.value.trim()) setSubjectError(null);
              }}
              aria-invalid={subjectError != null}
              aria-describedby={subjectError ? `${subjectId}-error` : undefined}
            />
            {subjectError ? (
              <p id={`${subjectId}-error`} className="text-sm text-destructive">
                {subjectError}
              </p>
            ) : null}
          </div>

          {previewLoading ? (
            <p className="text-sm text-muted-foreground">Loading email draft…</p>
          ) : previewError ? (
            <p className="text-sm text-destructive">{previewError}</p>
          ) : segments.length > 0 ? (
            <CentreEmailBodyEditor
              segments={segments}
              disabled={busy}
              onChange={onBodyChange}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Email draft unavailable.</p>
          )}

          <p className="text-sm text-muted-foreground">
            Changes made here affect this email only. They do not change the Shift or Batch in the
            platform.
          </p>

          {staleError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {staleError}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => (onBack ? onBack() : onOpenChange(false))}
          >
            {onBack ? "Back" : "Cancel"}
          </Button>
          <Button type="button" disabled={busy || !preview?.recipient || !body.trim()} onClick={handleSubmit}>
            {submitting ? "Sending…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
