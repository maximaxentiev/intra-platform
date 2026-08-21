import type { ReactNode } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shared DataTable visual conventions.
 *
 * These are class constants + a few thin row helpers on top of the existing
 * shadcn Table primitives — deliberately NOT a generic data-grid framework.
 */
export const dataTable = {
  /** Wrapper around <Table> so tables read as one bordered surface. */
  shell: "overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs",
  /** Horizontal scroll container for wide tables on small screens. */
  scroll: "w-full overflow-x-auto",
  header: "bg-surface-muted",
  headerCell:
    "h-9 whitespace-nowrap px-3 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground",
  row: "border-b border-border/60 last:border-0",
  rowInteractive:
    "cursor-pointer transition-colors hover:bg-muted/50 focus-within:bg-muted/50 motion-reduce:transition-none",
  cell: "h-11 px-3 align-middle text-sm text-foreground",
  cellMuted: "text-muted-foreground",
  cellNumeric: "text-right tabular-nums",
  /** Status columns sit left of the trailing actions column. */
  cellStatus: "whitespace-nowrap",
  /** Trailing actions column: right aligned, never grows. */
  cellActions: "w-px whitespace-nowrap px-3 text-right",
} as const;

/** Shape-matched loading rows for a table body. */
export function DataTableLoadingRows({ rows = 6, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex} className={dataTable.row} aria-hidden>
          {Array.from({ length: columns }).map((__, cellIndex) => (
            <TableCell key={cellIndex} className={dataTable.cell}>
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Single centered row used when a table has no results. */
export function DataTableEmptyRow({
  columns,
  children,
  className,
}: {
  columns: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={columns}
        className={cn("h-24 px-3 text-center text-sm text-muted-foreground", className)}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}
