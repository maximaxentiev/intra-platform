import { useState } from "react";
import { CalendarCheck2, Check, Loader2, ThumbsDown, UserCheck } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACTION_COPY,
  availableActions,
  type ApplicationAction,
} from "@/lib/application-actions";
import type { ApplicationStatus } from "@/lib/applications";

export function ApplicationActionButtons({
  status,
  applicantName,
  pendingAction,
  onConfirm,
  size = "sm",
}: {
  status: ApplicationStatus;
  applicantName: string;
  pendingAction: ApplicationAction | null;
  onConfirm: (action: ApplicationAction) => void;
  size?: "sm" | "md";
}) {
  const [dialog, setDialog] = useState<ApplicationAction | null>(null);
  const avail = availableActions(status);
  const busy = pendingAction !== null;
  const h = size === "md" ? "h-9 px-3 text-sm" : "h-7 px-2 text-xs";

  if (avail.interview === "hidden" && avail.reject === "hidden" && avail.hire === "hidden") {
    return (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {status === "hired" ? "Hired — no further actions" : "Rejected — no further actions"}
      </span>
    );
  }

  const copy = dialog ? ACTION_COPY[dialog] : null;

  return (
    <>
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {avail.interview === "done" ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-warning/25 bg-warning-soft px-2 text-xs font-medium text-warning whitespace-nowrap",
              size === "md" ? "h-9" : "h-7",
            )}
          >
            <Check className="h-3.5 w-3.5" /> Interview
          </span>
        ) : (
          <Button
            variant="outline"
            className={cn(h, "whitespace-nowrap")}
            disabled={busy}
            onClick={() => setDialog("interview")}
          >
            {pendingAction === "interview" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <CalendarCheck2 className="h-3.5 w-3.5 mr-1" />
            )}
            Interview
          </Button>
        )}
        <Button
          variant="outline"
          className={cn(
            h,
            "whitespace-nowrap border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive",
          )}
          disabled={busy}
          onClick={() => setDialog("reject")}
        >
          {pendingAction === "reject" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5 mr-1" />
          )}
          Reject
        </Button>
        <Button className={cn(h, "whitespace-nowrap")} disabled={busy} onClick={() => setDialog("hire")}>
          {pendingAction === "hire" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <UserCheck className="h-3.5 w-3.5 mr-1" />
          )}
          Hire
        </Button>
      </div>

      <AlertDialog open={dialog !== null} onOpenChange={(v) => !v && setDialog(null)}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          {copy && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{copy.title(applicantName)}</AlertDialogTitle>
                <AlertDialogDescription>{copy.body(applicantName)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={
                    dialog === "reject"
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : undefined
                  }
                  onClick={() => {
                    const action = dialog;
                    setDialog(null);
                    if (action) onConfirm(action);
                  }}
                >
                  {copy.confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
