import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { centresApi, channelLabel } from "@/lib/db";
import {
  centreLocationOrFallback,
  centrePrimaryContactLabel,
  centreResultCountLabel,
  filterCentresByName,
} from "@/lib/centres-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import {
  EmptyState,
  ListLoading,
  dataTable,
  DataTableEmptyRow,
  DataTableLoadingRows,
} from "@/components/ui-kit";
import { AlertCircle, Building2, ChevronRight, Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/centres/")({
  component: CentresIndex,
});

function CentresIndex() {
  // Live, client-side, name-only search. No Apply button, no URL search state.
  const [q, setQ] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["centres"],
    queryFn: () => centresApi.list(),
  });

  const list = data ?? [];
  const filtered = filterCentresByName(list, q);
  const searching = q.trim() !== "";

  const emptyState = searching ? (
    <EmptyState
      title="No centres match your search"
      description="Try a different name, or clear the search."
      action={
        <Button size="sm" variant="outline" onClick={() => setQ("")}>
          Clear search
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Building2}
      title="No centres yet"
      description="Add the first centre to start scheduling shifts."
      action={
        <Button asChild size="sm">
          <Link to="/centres/new">
            <Plus className="h-4 w-4" aria-hidden /> Add centre
          </Link>
        </Button>
      }
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centres"
        actions={
          <Button asChild>
            <Link to="/centres/new">
              <Plus className="h-4 w-4 mr-1.5" /> Add centre
            </Link>
          </Button>
        }
      />

      <Card className="gap-0 border-border/70 px-3.5 py-3 shadow-xs sm:px-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full space-y-1.5 sm:max-w-sm">
            <Label htmlFor="centre-search" className="text-xs font-medium text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="centre-search"
                placeholder="Search by centre name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground" aria-live="polite">
            {isLoading
              ? "Loading…"
              : isError
                ? "Results unavailable"
                : centreResultCountLabel(filtered.length, list.length)}
          </p>
        </div>
      </Card>

      {isError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Centre directory could not be loaded</p>
            <p className="text-[13px] text-muted-foreground">The request failed. No centres are shown.</p>
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
          {/* Mobile: compact centre cards */}
          <div className="md:hidden">
            {isLoading ? (
              <ListLoading rows={5} label="Loading centres" />
            ) : filtered.length === 0 ? (
              emptyState
            ) : (
              <ul className="space-y-2">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/centres/$id"
                      params={{ id: c.id }}
                      aria-label={`Open ${c.name}`}
                      className="flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-xs transition-colors hover:bg-muted/50 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {centreLocationOrFallback(c.address, c.city)}
                        </p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {centrePrimaryContactLabel(c)}
                        </p>
                        <Badge variant="secondary" className="mt-0.5 font-normal">
                          {channelLabel(c.primaryChannel)}
                        </Badge>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Desktop: compact directory table */}
          <div className={`hidden md:block ${dataTable.shell}`}>
            <div className={dataTable.scroll}>
              <Table>
                <TableHeader className={dataTable.header}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={dataTable.headerCell}>Centre</TableHead>
                    <TableHead className={dataTable.headerCell}>Location</TableHead>
                    <TableHead className={dataTable.headerCell}>Primary contact</TableHead>
                    <TableHead className={dataTable.headerCell}>Preferred channel</TableHead>
                    <TableHead className={dataTable.headerCell}>
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <DataTableLoadingRows rows={6} columns={5} />}
                  {!isLoading && filtered.length === 0 && (
                    <DataTableEmptyRow columns={5}>{emptyState}</DataTableEmptyRow>
                  )}
                  {!isLoading &&
                    filtered.map((c) => (
                      <TableRow
                        key={c.id}
                        className={`relative ${dataTable.row} ${dataTable.rowInteractive}`}
                      >
                        <TableCell className={`${dataTable.cell} max-w-[280px] font-medium`}>
                          <Link
                            to="/centres/$id"
                            params={{ id: c.id }}
                            aria-label={`Open ${c.name}`}
                            className="block truncate after:absolute after:inset-0 focus-visible:outline-none"
                          >
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell className={`${dataTable.cell} ${dataTable.cellMuted} max-w-[280px] truncate`}>
                          {centreLocationOrFallback(c.address, c.city)}
                        </TableCell>
                        <TableCell className={`${dataTable.cell} max-w-[200px] truncate`}>
                          {centrePrimaryContactLabel(c)}
                        </TableCell>
                        <TableCell className={`${dataTable.cell} ${dataTable.cellStatus}`}>
                          <Badge variant="secondary" className="font-normal">
                            {channelLabel(c.primaryChannel)}
                          </Badge>
                        </TableCell>
                        <TableCell className={`${dataTable.cell} ${dataTable.cellActions}`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
