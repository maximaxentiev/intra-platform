import { useEffect, useId, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { CentreEmailPreview, CentreEmailRecipient } from "@/lib/centre-email-review";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: CentreEmailPreview | null;
  previewLoading?: boolean;
  previewError?: string | null;
  subject: string;
  message: string;
  onSubjectChange: (value: string) => void;
  onMessageChange: (value: string) => void;
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
  message,
  onSubjectChange,
  onMessageChange,
  submitting = false,
  submitLabel = "Send confirmation",
  staleError,
  onBack,
  onSubmit,
}: Props) {
  const subjectId = useId();
  const messageId = useId();
  const previewId = useId();
  const [subjectError, setSubjectError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSubjectError(null);
  }, [open]);

  function handleSubmit() {
    if (!subject.trim()) {
      setSubjectError("Subject is required.");
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
            Review and customize the Centre confirmation email before it is sent. Shift and Batch
            details below are generated from the current record and cannot be edited here.
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

          <div className="space-y-2">
            <Label htmlFor={messageId}>Message</Label>
            <Textarea
              id={messageId}
              value={message}
              disabled={busy}
              rows={5}
              maxLength={10000}
              onChange={(event) => onMessageChange(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label id={`${previewId}-label`}>Email preview</Label>
            <div
              id={previewId}
              role="region"
              aria-labelledby={`${previewId}-label`}
              className="rounded-lg border border-border/70 bg-white p-4 text-sm text-foreground"
            >
              {previewLoading ? (
                <p className="text-muted-foreground">Loading preview…</p>
              ) : previewError ? (
                <p className="text-destructive">{previewError}</p>
              ) : preview?.html ? (
                <div
                  className="centre-email-preview [&_a]:pointer-events-none [&_a]:cursor-default"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              ) : (
                <p className="text-muted-foreground">Preview unavailable.</p>
              )}
            </div>
          </div>

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
          <Button type="button" disabled={busy || !preview?.recipient} onClick={handleSubmit}>
            {submitting ? "Sending…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
