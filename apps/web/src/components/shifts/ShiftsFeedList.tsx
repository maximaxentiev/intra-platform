import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/StatusBadge";
import { dataTable, DataTableEmptyRow, DataTableLoadingRows } from "@/components/ui-kit";
import {
  batchFeedStateLabel,
  formatBatchFeedDateLabel,
} from "@/lib/shifts-feed-ui";
import { displayStaff, fmtTime, type ShiftFeedItem, type ShiftFeedShiftSummary, type ShiftStatus } from "@/lib/db";
import { shiftAssigneeLabel } from "@/lib/shifts-list-ui";
import { Info } from "lucide-react";

const STAFFPOINT_HELP =
  "Whether this shift has also been posted to Staffpoint, the external staffing marketplace.";

const BATCH_CHILD_BG = "bg-[#e8eefe] hover:bg-[#dfe8fd]";

function assignedNameOf(s: ShiftFeedShiftSummary) {
  return s.assignedStaffId && s.assignedLegalName
    ? displayStaff({
        legalName: s.assignedLegalName,
        displayName: s.assignedDisplayName ?? "",
        useDisplayName: s.assignedUseDisplayName ?? false,
      })
    : null;
}

function ShiftDataCells({
  shift,
}: {
  shift: ShiftFeedShiftSummary;
}) {
  const assignedName = assignedNameOf(shift);
  const assignee = shiftAssigneeLabel(assignedName, shift.status as ShiftStatus);
  const quiet = shift.status === "completed" || shift.status === "cancelled";

  return (
    <>
      <TableCell className={`${dataTable.cell} tabular-nums`}>{shift.shiftDate}</TableCell>
      <TableCell className={`${dataTable.cell} ${dataTable.cellMuted} tabular-nums`}>
        {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
      </TableCell>
      <TableCell className={dataTable.cell}>{shift.roleNeeded || "—"}</TableCell>
      <TableCell className={dataTable.cell}>
        <span className={assignee.needsStaff ? "font-medium text-foreground" : assignedName ? "" : "text-muted-foreground"}>
          {assignee.text}
        </span>
      </TableCell>
      <TableCell className={`${dataTable.cell} ${dataTable.cellMuted}`}>
        {shift.addedToStaffpoint ? "Yes" : "No"}
      </TableCell>
      <TableCell className={`${dataTable.cell} ${dataTable.cellStatus}`}>
        <StatusBadge status={shift.status}>{shift.status}</StatusBadge>
      </TableCell>
      <TableCell className={`${dataTable.cell} ${dataTable.cellActions}`}>
        <ChevronRight className={`h-4 w-4 text-muted-foreground ${quiet ? "opacity-70" : ""}`} aria-hidden />
      </TableCell>
    </>
  );
}

export function ShiftsFeedList({
  items,
  isLoading,
  expandedBatchIds,
  onToggleBatch,
  emptyState,
}: {
  items: ShiftFeedItem[];
  isLoading: boolean;
  expandedBatchIds: Set<string>;
  onToggleBatch: (batchId: string) => void;
  emptyState: React.ReactNode;
}) {
  return (
    <>
      <div className="md:hidden">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          emptyState
        ) : (
          <ul className="space-y-2">
            {items.map((item) =>
              item.type === "shift" ? (
                <ShiftMobileCard key={item.shift.id} shift={item.shift} />
              ) : (
                <BatchMobileCard
                  key={item.batch.id}
                  item={item}
                  expanded={expandedBatchIds.has(item.batch.id)}
                  onToggle={() => onToggleBatch(item.batch.id)}
                />
              ),
            )}
          </ul>
        )}
      </div>

      <div className={`hidden md:block ${dataTable.shell}`}>
        <div className={dataTable.scroll}>
          <Table>
            <TableHeader className={dataTable.header}>
              <TableRow className="hover:bg-transparent">
                <TableHead className={dataTable.headerCell}>Centre</TableHead>
                <TableHead className={dataTable.headerCell}>Date</TableHead>
                <TableHead className={dataTable.headerCell}>Time</TableHead>
                <TableHead className={dataTable.headerCell}>Role</TableHead>
                <TableHead className={dataTable.headerCell}>Assigned to</TableHead>
                <TableHead className={dataTable.headerCell}>
                  <span className="inline-flex items-center gap-1">
                    Staffpoint
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`About Staffpoint. ${STAFFPOINT_HELP}`}
                          className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Info className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64">{STAFFPOINT_HELP}</TooltipContent>
                    </Tooltip>
                  </span>
                </TableHead>
                <TableHead className={dataTable.headerCell}>Filled</TableHead>
                <TableHead className={dataTable.headerCell}><span className="sr-only">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <DataTableLoadingRows rows={6} columns={8} />}
              {!isLoading && items.length === 0 && (
                <DataTableEmptyRow columns={8}>{emptyState}</DataTableEmptyRow>
              )}
              {!isLoading &&
                items.map((item) =>
                  item.type === "shift" ? (
                    <TableRow key={item.shift.id} className={`relative ${dataTable.row} ${dataTable.rowInteractive}`}>
                      <TableCell className={`${dataTable.cell} max-w-[220px] truncate font-medium`}>
                        <Link
                          to="/shifts/$id"
                          params={{ id: item.shift.id }}
                          aria-label={`Open shift at ${item.shift.centreName} on ${item.shift.shiftDate}`}
                          className="after:absolute after:inset-0 focus-visible:outline-none"
                        >
                          {item.shift.centreName}
                        </Link>
                      </TableCell>
                      <ShiftDataCells shift={item.shift} />
                    </TableRow>
                  ) : (
                    <BatchDesktopRows
                      key={item.batch.id}
                      item={item}
                      expanded={expandedBatchIds.has(item.batch.id)}
                      onToggle={() => onToggleBatch(item.batch.id)}
                    />
                  ),
                )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

function BatchDesktopRows({
  item,
  expanded,
  onToggle,
}: {
  item: Extract<ShiftFeedItem, { type: "batch" }>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const batchStatus =
    item.batch.displayState === "open"
      ? "pending"
      : item.batch.displayState === "ready"
        ? "filled"
        : "completed";

  return (
    <>
      <TableRow className="border-primary/15 bg-primary/[0.04] hover:bg-primary/[0.06]">
        <TableCell className={`${dataTable.cell} max-w-[220px] py-5 font-semibold`}>
          {item.batch.centreName}
        </TableCell>
        <TableCell className={`${dataTable.cell} py-5 tabular-nums whitespace-nowrap`}>
          {formatBatchFeedDateLabel(item.batch.dateRange)}
        </TableCell>
        <TableCell className={`${dataTable.cell} py-5`}>
          <span className="rounded-full border border-primary/20 bg-primary/[0.08] px-2.5 py-1 text-xs font-medium text-foreground">
            Batch Request
          </span>
        </TableCell>
        <TableCell className={`${dataTable.cell} py-5`} colSpan={3}>
          <div className="flex items-center gap-2">
            <StatusBadge status={batchStatus}>{batchFeedStateLabel(item.batch.displayState)}</StatusBadge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-expanded={expanded}
              aria-label={`${expanded ? "Collapse" : "Expand"} batch at ${item.batch.centreName}`}
              onClick={onToggle}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                aria-hidden
              />
            </Button>
          </div>
        </TableCell>
        <TableCell className={`${dataTable.cell} py-5`} />
        <TableCell className={`${dataTable.cell} ${dataTable.cellActions} py-5`}>
          <Button asChild size="sm" className="relative z-10">
            <Link to="/shifts/batches/$id" params={{ id: item.batch.id }}>
              Open batch
            </Link>
          </Button>
        </TableCell>
      </TableRow>
      {expanded
        ? item.matchingChildren.map((child) => (
            <TableRow
              key={child.id}
              className={`relative ${dataTable.row} ${dataTable.rowInteractive} ${BATCH_CHILD_BG}`}
            >
              <TableCell className={`${dataTable.cell} max-w-[220px] pl-8 text-muted-foreground`}>
                <Link
                  to="/shifts/$id"
                  params={{ id: child.id }}
                  aria-label={`Open shift on ${child.shiftDate}`}
                  className="after:absolute after:inset-0 focus-visible:outline-none"
                >
                  ↳ {item.batch.centreName}
                </Link>
              </TableCell>
              <ShiftDataCells shift={child} />
            </TableRow>
          ))
        : null}
    </>
  );
}

function ShiftMobileCard({ shift }: { shift: ShiftFeedShiftSummary }) {
  const assignedName = assignedNameOf(shift);
  const assignee = shiftAssigneeLabel(assignedName, shift.status as ShiftStatus);
  const quiet = shift.status === "completed" || shift.status === "cancelled";

  return (
    <li>
      <Link
        to="/shifts/$id"
        params={{ id: shift.id }}
        className={`flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-xs transition-colors hover:bg-muted/50 ${quiet ? "opacity-75" : ""}`}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tabular-nums">{shift.shiftDate}</span>
            <StatusBadge status={shift.status}>{shift.status}</StatusBadge>
          </div>
          <div className="truncate text-sm text-foreground">{shift.centreName}</div>
          <div className="text-[13px] tabular-nums text-muted-foreground">
            {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
            {shift.roleNeeded ? ` · ${shift.roleNeeded}` : ""}
          </div>
          <div className={assignee.needsStaff ? "text-[13px] font-medium text-foreground" : "text-[13px] text-muted-foreground"}>
            {assignee.text}
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function BatchMobileCard({
  item,
  expanded,
  onToggle,
}: {
  item: Extract<ShiftFeedItem, { type: "batch" }>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const batchStatus =
    item.batch.displayState === "open"
      ? "pending"
      : item.batch.displayState === "ready"
        ? "filled"
        : "completed";

  return (
    <li className="rounded-xl border border-primary/15 bg-primary/[0.04] shadow-xs">
      <div className="flex flex-col gap-3 px-3.5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-foreground">{item.batch.centreName}</span>
          <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
            {formatBatchFeedDateLabel(item.batch.dateRange)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-xs font-medium">
            Batch Request
          </span>
          <StatusBadge status={batchStatus}>{batchFeedStateLabel(item.batch.displayState)}</StatusBadge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} batch at ${item.batch.centreName}`}
            onClick={onToggle}
          >
            <ChevronDown className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`} aria-hidden />
          </Button>
          <Button asChild size="sm" className="ml-auto">
            <Link to="/shifts/batches/$id" params={{ id: item.batch.id }}>Open batch</Link>
          </Button>
        </div>
      </div>
      {expanded ? (
        <ul className="space-y-2 border-t border-primary/10 px-3 pb-3 pt-2">
          {item.matchingChildren.map((child) => (
            <li key={child.id}>
              <Link
                to="/shifts/$id"
                params={{ id: child.id }}
                className={`block rounded-lg border border-primary/10 px-3 py-2.5 ${BATCH_CHILD_BG}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium tabular-nums">{child.shiftDate}</span>
                  <StatusBadge status={child.status}>{child.status}</StatusBadge>
                </div>
                <p className="mt-1 text-[13px] tabular-nums text-muted-foreground">
                  {fmtTime(child.startTime)} – {fmtTime(child.endTime)} · {child.roleNeeded || "—"}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {shiftAssigneeLabel(assignedNameOf(child), child.status as ShiftStatus).text}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
