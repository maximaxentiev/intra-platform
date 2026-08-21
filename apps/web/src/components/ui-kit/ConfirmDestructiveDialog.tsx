import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * The single destructive-confirmation pattern for the Ops platform.
 *
 * Rules encoded here:
 * - the trigger lives in secondary/overflow treatment, never as a page primary
 * - the description states the consequence, not just "are you sure?"
 * - Cancel stays first and is never de-emphasised
 * - the confirm button is destructive-toned only for truly destructive work;
 *   pass `tone="default"` for operational workflows such as cancelling a shift
 */
export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  consequence,
  details,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  confirmDisabled,
  tone = "destructive",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One sentence explaining what will happen and whether it can be undone. */
  consequence: ReactNode;
  /** Optional extra context (affected records, follow-up steps). */
  details?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  tone?: "destructive" | "default";
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        {details && <div className="text-sm text-muted-foreground">{details}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={cn(
              tone === "destructive" &&
                buttonVariants({ variant: "destructive" }),
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
