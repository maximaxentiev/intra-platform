import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DashboardEmpty,
  DashboardFooterLink,
  DashboardSection,
} from "./DashboardPrimitives";
import type { DashboardOverviewResponse, DashboardTodayShiftItem } from "@/lib/dashboard-api";
import {
  describeShiftUrgency,
  formatShiftTimeRange,
  todayShiftsSearch,
} from "@/lib/dashboard-overview-ui";
import { cn } from "@/lib/utils";

function urgencyNote(shift: DashboardTodayShiftItem) {
  if (shift.status !== "pending") return null;
  const urgency = describeShiftUrgency(shift.minutesUntilStart, { unfilled: true });
  return (
    <span
      className={cn(
        "text-xs font-medium",
        urgency.level === "critical" ? "text-destructive" : "text-warning",
      )}
    >
      {urgency.label}
    </span>
  );
}

export function TodayShiftsSection({
  today,
}: {
  today: DashboardOverviewResponse["today"];
}) {
  const shifts = today.shifts;

  return (
    <DashboardSection
      id="today-shifts"
      title="Today's shifts"
      description="Schedule for today in Toronto."
      action={
        <DashboardFooterLink to="/shifts" search={todayShiftsSearch(today.date)}>
          View shifts
        </DashboardFooterLink>
      }
    >
      {shifts.length === 0 ? (
        <DashboardEmpty
          title="No shifts scheduled today"
          description="There are no shifts on the schedule for today."
          action={
            <Button asChild size="sm">
              <Link to="/shifts/new">
                <Plus className="h-4 w-4" aria-hidden="true" /> Create shift
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="border-border/70 py-0 shadow-xs">
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[190px]">Time</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead className="w-[110px]">Role</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[110px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.shiftId} className="hover:bg-accent/60">
                    <TableCell className="whitespace-nowrap font-medium tabular-nums">
                      {formatShiftTimeRange(shift.startTime, shift.endTime)}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{shift.centreName}</TableCell>
                    <TableCell>{shift.role}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {shift.assignedStaffName ?? (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={shift.status} />
                        {urgencyNote(shift)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant={shift.status === "pending" ? "outline" : "ghost"}>
                        <Link to="/shifts/$id" params={{ id: shift.shiftId }}>
                          {shift.status === "pending" ? "Assign" : "View"}
                          <span className="sr-only"> shift at {shift.centreName}</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y divide-border md:hidden">
            {shifts.map((shift) => (
              <li key={shift.shiftId} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatShiftTimeRange(shift.startTime, shift.endTime)}
                  </p>
                  <StatusBadge status={shift.status} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{shift.centreName}</p>
                  <p className="text-sm text-muted-foreground">
                    {shift.role} · {shift.assignedStaffName ?? "Unassigned"}
                  </p>
                  {urgencyNote(shift)}
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to="/shifts/$id" params={{ id: shift.shiftId }}>
                    {shift.status === "pending" ? "Assign staff" : "View shift"}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>

          {today.hasMoreShifts && (
            <div className="border-t border-border px-4 py-3">
              <DashboardFooterLink to="/shifts" search={todayShiftsSearch(today.date)}>
                View all today's shifts
              </DashboardFooterLink>
            </div>
          )}
        </Card>
      )}
    </DashboardSection>
  );
}
