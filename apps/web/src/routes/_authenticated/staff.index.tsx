import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { staffApi, displayStaff, type Staff } from "@/lib/db";
import {
  PORTAL_ACCOUNT_STATUS_LABELS,
  type PortalAccountDisplayStatus,
} from "@/lib/portal-account-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { PortalStatusBadge } from "@/components/PortalStatusBadge";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import {
  EmptyState,
  FilterChipBar,
  ListLoading,
  dataTable,
  DataTableEmptyRow,
  DataTableLoadingRows,
} from "@/components/ui-kit";
import {
  EMPTY_STAFF_FILTERS,
  buildStaffFilterChips,
  clearStaffFilterChip,
  filterStaffList,
  hasActiveStaffFilters,
  staffContactLines,
  staffPortalStatusOf,
  staffResultCountLabel,
  staffRoleOptions,
  type StaffFilterState,
} from "@/lib/staff-list-ui";
import { AlertCircle, ChevronRight, Plus, Search, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/")({
  component: StaffIndex,
});

const PORTAL_FILTER_OPTIONS: PortalAccountDisplayStatus[] = [
  "no_account",
  "invited",
  "incomplete",
  "active",
  "disabled",
];

function StaffIndex() {
  // Live client-side filters — no Apply button, no URL search state.
  const [filters, setFilters] = useState<StaffFilterState>(EMPTY_STAFF_FILTERS);
  const set = <K extends keyof StaffFilterState>(key: K, value: StaffFilterState[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => staffApi.list(),
  });

  const list: Staff[] = data ?? [];
  const roles = staffRoleOptions(list);
  const filtered = filterStaffList(list, filters);
  const active = hasActiveStaffFilters(filters);
  const chips = buildStaffFilterChips(filters).map((chip) => ({
    id: chip.id,
    field: chip.field,
    label: chip.label,
    onRemove: () => setFilters((prev) => clearStaffFilterChip(prev, chip.id)),
  }));

  const resultContext = isLoading
    ? "Loading…"
    : isError
      ? "Results unavailable"
      : staffResultCountLabel(filtered.length, list.length);

  function clearFilters() {
    setFilters(EMPTY_STAFF_FILTERS);
  }

  const emptyState = active ? (
    <EmptyState
      title="No staff match these filters"
      description="Adjust or clear the filters to see more results."
      action={
        <Button size="sm" variant="outline" onClick={clearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Users}
      title="No staff yet"
      description="Add your first staff member to get started."
      action={
        <Button asChild size="sm">
          <Link to="/staff/new">
            <Plus className="h-4 w-4" aria-hidden /> Add staff
          </Link>
        </Button>
      }
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        subtitle="Childcare staff directory."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link to="/staff/import">Import CSV</Link>
            </Button>
            <Button asChild>
              <Link to="/staff/new">
                <Plus className="h-4 w-4 mr-1.5" /> Add staff
              </Link>
            </Button>
          </div>
        }
      />

      {/* Live filters — results update as you type / select. */}
      <Card className="gap-0 border-border/70 px-3.5 py-3 shadow-xs sm:px-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_12rem]">
          <div className="space-y-1.5">
            <Label htmlFor="staff-search" className="text-xs font-medium text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="staff-search"
                placeholder="Search by name…"
                value={filters.q}
                onChange={(e) => set("q", e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Role</Label>
            <Select value={filters.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger className="h-9" aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Portal account</Label>
            <Select
              value={filters.portal}
              onValueChange={(v) => set("portal", v as StaffFilterState["portal"])}
            >
              <SelectTrigger className="h-9" aria-label="Filter by portal account status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All portal statuses</SelectItem>
                {PORTAL_FILTER_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PORTAL_ACCOUNT_STATUS_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[13px] text-muted-foreground" aria-live="polite">
            {resultContext}
          </p>
          {chips.length > 0 && <FilterChipBar chips={chips} onClearAll={clearFilters} />}
        </div>
      </Card>

      {isError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Staff directory could not be loaded</p>
            <p className="text-[13px] text-muted-foreground">
              The request failed. No staff results are being shown.
            </p>
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
      ) : (
        <>
          {/* Mobile / tablet: compact navigable cards */}
          <div className="lg:hidden">
            {isLoading ? (
              <ListLoading rows={5} label="Loading staff" />
            ) : filtered.length === 0 ? (
              emptyState
            ) : (
              <ul className="space-y-2">
                {filtered.map((s) => {
                  const contact = staffContactLines(s);
                  const portal = staffPortalStatusOf(s);
                  return (
                    <li key={s.id}>
                      <Link
                        to="/staff/$id"
                        params={{ id: s.id }}
                        aria-label={`Open profile for ${displayStaff(s)}`}
                        className="flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-xs transition-colors hover:bg-muted/50 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[15px] font-semibold">{displayStaff(s)}</span>
                          </div>
                          <div className="text-[13px] text-muted-foreground">
                            {s.role || "No role assigned"}
                          </div>
                          {contact.primary && (
                            <div className="min-w-0 text-[13px] text-foreground break-all">
                              {contact.primary}
                            </div>
                          )}
                          {contact.secondary && (
                            <div className="text-[13px] tabular-nums text-muted-foreground">
                              {contact.secondary}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <PortalStatusBadge status={portal} size="xs" />
                            <DocumentStatusBadge
                              status={s.documentStatus ?? "no_documents_submitted"}
                              size="xs"
                            />
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

          {/* Desktop: compact directory table */}
          <div className={`hidden lg:block ${dataTable.shell}`}>
            <div className={dataTable.scroll}>
              <Table>
                <TableHeader className={dataTable.header}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={dataTable.headerCell}>Name</TableHead>
                    <TableHead className={dataTable.headerCell}>Role</TableHead>
                    <TableHead className={dataTable.headerCell}>Contact</TableHead>
                    <TableHead className={dataTable.headerCell}>Portal</TableHead>
                    <TableHead className={dataTable.headerCell}>Documents</TableHead>
                    <TableHead className={dataTable.headerCell}>
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <DataTableLoadingRows rows={6} columns={6} />}
                  {!isLoading && filtered.length === 0 && (
                    <DataTableEmptyRow columns={6}>{emptyState}</DataTableEmptyRow>
                  )}
                  {!isLoading &&
                    filtered.map((s) => {
                      const contact = staffContactLines(s);
                      const portal = staffPortalStatusOf(s);
                      return (
                        <TableRow
                          key={s.id}
                          className={`relative ${dataTable.row} ${dataTable.rowInteractive}`}
                        >
                          <TableCell className={`${dataTable.cell} max-w-[18rem] font-medium`}>
                            <Link
                              to="/staff/$id"
                              params={{ id: s.id }}
                              aria-label={`Open profile for ${displayStaff(s)}`}
                              className="block truncate after:absolute after:inset-0 focus-visible:outline-none"
                            >
                              {displayStaff(s)}
                            </Link>
                          </TableCell>
                          <TableCell className={dataTable.cell}>
                            {s.role || <span className={dataTable.cellMuted}>—</span>}
                          </TableCell>
                          <TableCell className={`${dataTable.cell} max-w-[18rem] py-1.5`}>
                            {contact.primary ? (
                              <span className="block min-w-0">
                                <span className="block truncate">{contact.primary}</span>
                                {contact.secondary && (
                                  <span className="block truncate text-[13px] tabular-nums text-muted-foreground">
                                    {contact.secondary}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className={dataTable.cellMuted}>—</span>
                            )}
                          </TableCell>
                          <TableCell className={`${dataTable.cell} ${dataTable.cellStatus}`}>
                            <PortalStatusBadge status={portal} size="xs" />
                          </TableCell>
                          <TableCell className={`${dataTable.cell} ${dataTable.cellStatus}`}>
                            <DocumentStatusBadge
                              status={s.documentStatus ?? "no_documents_submitted"}
                              size="xs"
                            />
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
      )}
    </div>
  );
}
