import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { staffApi, fmtTime } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import {
  EmptyState,
  ListLoading,
  dataTable,
  DataTableEmptyRow,
  DataTableLoadingRows,
} from "@/components/ui-kit";
import { AlertCircle, CalendarClock, ChevronRight } from "lucide-react";

/** Answers one question: what shifts has this person been assigned? */
export function StaffShiftsTab({ staffId }: { staffId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["staff-shifts", staffId],
    queryFn: () => staffApi.shifts(staffId),
  });

  const rows = data ?? [];

  if (isError) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Assigned shifts could not be loaded</p>
          <p className="text-[13px] text-muted-foreground">The request failed. No shifts are shown.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Retrying…" : "Retry"}
        </Button>
      </div>
    );
  }

  const empty = (
    <EmptyState icon={CalendarClock} title="No shifts assigned yet." />
  );

  return (
    <>
      {/* Mobile: shift cards matching /shifts */}
      <div className="md:hidden">
        {isLoading ? (
          <ListLoading rows={4} label="Loading assigned shifts" />
        ) : rows.length === 0 ? (
          empty
        ) : (
          <ul className="space-y-2">
            {rows.map((s) => {
              const quiet = s.status === "completed" || s.status === "cancelled";
              return (
                <li key={s.id}>
                  <Link
                    to="/shifts/$id"
                    params={{ id: s.id }}
                    aria-label={`Open shift on ${s.shiftDate}`}
                    className={`flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-xs transition-colors hover:bg-muted/50 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${quiet ? "opacity-75" : ""}`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tabular-nums">{s.shiftDate}</span>
                        <StatusBadge status={s.status}>{s.status}</StatusBadge>
                      </div>
                      <div className="truncate text-sm text-foreground">{s.centreName}</div>
                      <div className="text-[13px] tabular-nums text-muted-foreground">
                        {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                        {s.roleNeeded ? ` · ${s.roleNeeded}` : ""}
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Desktop: compact table */}
      <div className={`hidden md:block ${dataTable.shell}`}>
        <div className={dataTable.scroll}>
          <Table>
            <TableHeader className={dataTable.header}>
              <TableRow className="hover:bg-transparent">
                <TableHead className={dataTable.headerCell}>Date</TableHead>
                <TableHead className={dataTable.headerCell}>Centre</TableHead>
                <TableHead className={dataTable.headerCell}>Time</TableHead>
                <TableHead className={dataTable.headerCell}>Role</TableHead>
                <TableHead className={dataTable.headerCell}>Status</TableHead>
                <TableHead className={dataTable.headerCell}>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <DataTableLoadingRows rows={4} columns={6} />}
              {!isLoading && rows.length === 0 && (
                <DataTableEmptyRow columns={6}>{empty}</DataTableEmptyRow>
              )}
              {!isLoading &&
                rows.map((s) => {
                  const quiet = s.status === "completed" || s.status === "cancelled";
                  return (
                    <TableRow
                      key={s.id}
                      className={`relative ${dataTable.row} ${dataTable.rowInteractive} ${quiet ? "opacity-75" : ""}`}
                    >
                      <TableCell className={`${dataTable.cell} font-medium tabular-nums`}>
                        <Link
                          to="/shifts/$id"
                          params={{ id: s.id }}
                          aria-label={`Open shift on ${s.shiftDate}`}
                          className="after:absolute after:inset-0 focus-visible:outline-none"
                        >
                          {s.shiftDate}
                        </Link>
                      </TableCell>
                      <TableCell className={`${dataTable.cell} max-w-[220px] truncate`}>
                        {s.centreName}
                      </TableCell>
                      <TableCell className={`${dataTable.cell} ${dataTable.cellMuted} tabular-nums`}>
                        {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                      </TableCell>
                      <TableCell className={dataTable.cell}>
                        {s.roleNeeded || <span className={dataTable.cellMuted}>—</span>}
                      </TableCell>
                      <TableCell className={`${dataTable.cell} ${dataTable.cellStatus}`}>
                        <StatusBadge status={s.status}>{s.status}</StatusBadge>
                      </TableCell>
                      <TableCell className={`${dataTable.cell} ${dataTable.cellActions}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
