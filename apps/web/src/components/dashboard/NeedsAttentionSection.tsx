import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, FileWarning, MailWarning } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardEmpty, DashboardSection } from "./DashboardPrimitives";
import type { DashboardOverviewResponse } from "@/lib/dashboard-api";
import {
  communicationAttentionMessage,
  communicationFailureLabel,
  describeShiftUrgency,
  documentAttentionMessages,
  formatDashboardInstantTime,
  formatShiftClock,
  hasAttentionItems,
} from "@/lib/dashboard-overview-ui";
import { cn } from "@/lib/utils";

export function NeedsAttentionSection({
  attention,
}: {
  attention: DashboardOverviewResponse["attention"];
}) {
  const docMessages = documentAttentionMessages(attention.documents);
  const commsMessage = communicationAttentionMessage(attention.communications.totalFailures);
  const anything = hasAttentionItems(attention);

  return (
    <DashboardSection id="needs-attention" title="Needs attention">
      {!anything ? (
        <div className="flex min-h-[44px] flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-success/20 bg-success-soft/30 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">You're all caught up</p>
          <p className="text-xs text-muted-foreground">Nothing requires your attention.</p>
        </div>
      ) : (
        <Card className="divide-y divide-border border-border/70 py-0 shadow-xs">
          {attention.urgentPendingShifts.map((shift) => {
            const urgency = describeShiftUrgency(shift.minutesUntilStart, { unfilled: true });
            return (
              <div
                key={shift.shiftId}
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      urgency.level === "critical" ? "text-destructive" : "text-warning",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {shift.centreName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {shift.role} · {formatShiftClock(shift.startTime)}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-xs font-medium",
                        urgency.level === "critical" ? "text-destructive" : "text-warning",
                      )}
                    >
                      {urgency.overdue ? urgency.label : `${urgency.label} · Unfilled`}
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                  <Link to="/shifts/$id" params={{ id: shift.shiftId }}>
                    Assign staff
                    <span className="sr-only"> for {shift.centreName}</span>
                  </Link>
                </Button>
              </div>
            );
          })}

          {attention.hasMoreUrgentPending && (
            <div className="px-4 py-3">
              <Link
                to="/shifts"
                search={{ status: "pending" } as any}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all {attention.totalUrgentPendingCount} urgent pending shifts →
              </Link>
            </div>
          )}

          {docMessages.length > 0 && (
            <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <ul className="min-w-0 space-y-0.5 text-sm text-foreground">
                  {docMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                <Link to="/reports/documents">Review documents</Link>
              </Button>
            </div>
          )}

          {commsMessage && (
            <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="flex min-w-0 items-start gap-3">
                <MailWarning
                  className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{commsMessage}</p>
                  <p className="text-xs text-muted-foreground">
                    Failures in the last {attention.communications.windowHours} hours.
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
                    {attention.communications.recentFailures.map((failure, index) => (
                      <li key={`${failure.occurredAt}-${index}`} className="truncate">
                        {failure.shiftId ? (
                          <Link
                            to="/shifts/$id"
                            params={{ id: failure.shiftId }}
                            className="text-foreground hover:underline"
                          >
                            {communicationFailureLabel(failure)}
                          </Link>
                        ) : (
                          <span className="text-foreground">
                            {communicationFailureLabel(failure)}
                          </span>
                        )}{" "}
                        · {formatDashboardInstantTime(failure.occurredAt)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                <Link to="/reports/activity">View activity</Link>
              </Button>
            </div>
          )}
        </Card>
      )}
    </DashboardSection>
  );
}

export function NeedsAttentionEmptyFallback() {
  return (
    <DashboardEmpty
      title="You're all caught up"
      description="Nothing currently requires your attention."
    />
  );
}
