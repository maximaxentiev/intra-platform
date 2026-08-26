import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  Inbox,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApplicationActionButtons } from "@/components/applications/ApplicationActions";
import { ApplicationDrawer } from "@/components/applications/ApplicationDrawer";
import { ApplicationStatusBadge } from "@/components/applications/primitives";
import { useDocumentViewer } from "@/components/applications/documents";
import {
  ActiveFilterChips,
  ApplicationsFilterPanel,
  EMPTY_FILTERS,
  countActiveFilters,
  type ApplicationFilters,
} from "@/components/applications/ApplicationsFilters";
import {
  columnsForRole,
  matchesFilters,
  matchesSearch,
  sortRows,
  type SortState,
} from "@/components/applications/columns";
import {
  ROLE_TABS,
  applicationsApi,
  fetchAllForRole,
  fullName,
  type ApplicationRole,
  type ApplicationRow,
  type ApplicationStatus,
} from "@/lib/applications";
import {
  ACTION_RESULT_STATUS,
  defaultApplicationActionHandler,
  type ApplicationAction,
} from "@/lib/application-actions";

export const Route = createFileRoute("/_authenticated/applications")({
  component: ApplicationsPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
});

const PAGE_SIZE = 25;

function ApplicationsPage() {
  const [role, setRole] = useState<ApplicationRole>("eca");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ApplicationFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<Record<string, string[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; action: ApplicationAction } | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ApplicationStatus>>({});
  const docs = useDocumentViewer();

  const listQuery = useQuery({
    queryKey: ["applications", role],
    queryFn: () => fetchAllForRole(role),
    staleTime: 30_000,
  });

  const detailQueries = useQueries({
    queries: (listQuery.data ?? []).map((item) => ({
      queryKey: ["application", item.id],
      queryFn: () => applicationsApi.get(item.id),
      staleTime: 60_000,
    })),
  });

  const rows: ApplicationRow[] = useMemo(() => {
    const items = listQuery.data ?? [];
    return detailQueries
      .map((q, i) => {
        const detail = q.data;
        const item = items[i];
        if (!detail || !item) return null;
        return {
          ...detail,
          status: statusOverrides[detail.id] ?? detail.status,
          submittedAt: item.submittedAt ?? detail.metadata.submittedAt,
        } as ApplicationRow;
      })
      .filter((r): r is ApplicationRow => r !== null);
  }, [detailQueries, listQuery.data, statusOverrides]);

  const detailsLoading = detailQueries.some((q) => q.isLoading);
  const loading = listQuery.isLoading || (rows.length === 0 && detailsLoading);
  const errored = listQuery.isError || (!listQuery.isLoading && detailQueries.some((q) => q.isError));

  const allColumns = useMemo(() => columnsForRole(role), [role]);
  const hiddenForRole = hidden[role] ?? [];
  const columns = useMemo(
    () => allColumns.filter((c) => !hiddenForRole.includes(c.key)),
    [allColumns, hiddenForRole],
  );

  const filtered = useMemo(
    () => rows.filter((r) => matchesSearch(r, search) && matchesFilters(r, filters)),
    [rows, search, filters],
  );
  const sorted = useMemo(() => sortRows(filtered, sort, allColumns), [filtered, sort, allColumns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const openRow = rows.find((r) => r.id === openId) ?? null;
  const activeFilterCount = countActiveFilters(filters);
  const hasQuery = activeFilterCount > 0 || search.trim() !== "";

  function changeRole(next: ApplicationRole) {
    setRole(next);
    setPage(0);
    setSort(null);
    setFilters(EMPTY_FILTERS);
    setSearch("");
  }

  function toggleSort(key: string) {
    setPage(0);
    setSort((prev) =>
      !prev || prev.key !== key
        ? { key, dir: "asc" }
        : prev.dir === "asc"
          ? { key, dir: "desc" }
          : null,
    );
  }

  async function runAction(id: string, action: ApplicationAction) {
    setPending({ id, action });
    try {
      const res = await defaultApplicationActionHandler({ id, action });
      setStatusOverrides((prev) => ({ ...prev, [res.id]: res.status ?? ACTION_RESULT_STATUS[action] }));
    } finally {
      setPending(null);
    }
  }

  const sortIcon = (key: string) =>
    sort?.key !== key ? (
      <ChevronsUpDown className="h-3 w-3 opacity-40" />
    ) : sort.dir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );

  return (
    <div className="space-y-5">
      <PageHeader title="Applications" />

      {/* Role switcher */}
      <Tabs value={role} onValueChange={(v) => changeRole(v as ApplicationRole)}>
        <TabsList>
          {ROLE_TABS.map((t) => (
            <TabsTrigger key={t.role} value={t.role}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name, email or phone…"
            className="h-10 pl-9 pr-9"
            aria-label="Search applications"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ApplicationsFilterPanel
            role={role}
            rows={rows}
            filters={filters}
            onChange={(f) => {
              setFilters(f);
              setPage(0);
            }}
            onClear={() => setFilters(EMPTY_FILTERS)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10">
                <Columns3 className="h-4 w-4 mr-1.5" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-0">
              <DropdownMenuLabel className="px-3 py-2">Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator className="m-0" />
              <ScrollArea className="max-h-72">
                <div className="space-y-1 p-2">
                  {allColumns.map((c) => {
                    const visible = !hiddenForRole.includes(c.key);
                    return (
                      <label
                        key={c.key}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted"
                      >
                        <Checkbox
                          checked={visible}
                          onCheckedChange={(v) =>
                            setHidden((prev) => ({
                              ...prev,
                              [role]: v
                                ? (prev[role] ?? []).filter((k) => k !== c.key)
                                : [...(prev[role] ?? []), c.key],
                            }))
                          }
                        />
                        <span className="truncate">{c.header}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
              <DropdownMenuSeparator className="m-0" />
              <div className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => setHidden((prev) => ({ ...prev, [role]: [] }))}
                >
                  Show all columns
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ActiveFilterChips
        filters={filters}
        onRemove={(key) =>
          setFilters((prev) => ({ ...prev, [key]: EMPTY_FILTERS[key] } as ApplicationFilters))
        }
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {/* Result count */}
      {!loading && !errored && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {sorted.length} application{sorted.length === 1 ? "" : "s"}
            {hasQuery ? ` of ${rows.length}` : ""}
          </span>
          {detailsLoading && (
            <span className="inline-flex items-center gap-1 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" /> loading details…
            </span>
          )}
        </div>
      )}

      {/* States */}
      {errored ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden />
          <p className="mt-2 text-sm font-medium">Couldn’t load applications</p>
          <p className="text-xs text-muted-foreground">
            {(listQuery.error as Error | undefined)?.message ?? "The applications service is unavailable."}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => listQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Inbox className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm font-medium">No applications yet</p>
          <p className="text-xs text-muted-foreground">
            New {ROLE_TABS.find((t) => t.role === role)?.label} applications will appear here.
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Search className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm font-medium">No matching applications</p>
          <p className="text-xs text-muted-foreground">Try adjusting your search or filters.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setSearch("");
              setFilters(EMPTY_FILTERS);
            }}
          >
            Clear search & filters
          </Button>
        </div>
      ) : (
        <>
          <div className="relative overflow-auto rounded-lg border border-border bg-card max-h-[70vh]">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 top-0 z-30 border-b border-r border-border bg-muted px-3 py-2 text-left font-medium text-muted-foreground"
                    style={{ minWidth: 200 }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("applicant")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Applicant {sortIcon("applicant")}
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-20 border-b border-border bg-muted px-3 py-2 text-left font-medium text-muted-foreground"
                    style={{ minWidth: 110 }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Status {sortIcon("status")}
                    </button>
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className="sticky top-0 z-20 border-b border-border bg-muted px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                      style={{ minWidth: c.minWidth }}
                    >
                      {c.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {c.header} {sortIcon(c.key)}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="sticky right-0 top-0 z-40 border-b border-l border-border bg-muted px-3 py-2 text-left font-medium text-muted-foreground shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.12)]"
                    style={{ minWidth: 250 }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    onClick={() => setOpenId(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setOpenId(r.id);
                    }}
                    className="group cursor-pointer outline-none focus-visible:bg-muted/60"
                  >
                    <td className="sticky left-0 z-20 border-b border-r border-border bg-card px-3 py-2 group-hover:bg-muted">
                      <div className="max-w-[15rem] truncate font-medium">{fullName(r)}</div>
                    </td>
                    <td className="border-b border-border bg-card px-3 py-2 group-hover:bg-muted">
                      <ApplicationStatusBadge status={r.status} />
                    </td>
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className="border-b border-border bg-card px-3 py-2 group-hover:bg-muted"
                        style={{ maxWidth: Math.max(c.minWidth, 240) }}
                      >
                        {c.cell(r, { openDoc: docs.open, openRow: setOpenId })}
                      </td>
                    ))}
                    <td className="sticky right-0 z-30 isolate border-b border-l border-border bg-card px-3 py-2 shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.08)] group-hover:bg-muted">
                      <ApplicationActionButtons
                        status={r.status}
                        applicantName={fullName(r)}
                        pendingAction={pending?.id === r.id ? pending.action : null}
                        onConfirm={(action) => runAction(r.id, action)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} of{" "}
              {sorted.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {safePage + 1} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <ApplicationDrawer
        row={openRow}
        open={openId !== null}
        onOpenChange={(v) => !v && setOpenId(null)}
        pendingAction={pending?.id === openRow?.id ? (pending?.action ?? null) : null}
        onAction={runAction}
        onOpenDoc={docs.open}
      />
      {docs.viewer}
    </div>
  );
}
