import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  MessageSquare,
  Settings,
  User,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ActivityLogFilters } from "@/components/reports/ActivityLogFilters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { centresApi, staffApi } from "@/lib/db";
import { formatOpsDateTimeToronto, formatOpsDateToronto } from "@/lib/ops-report-formatters";
import { defaultActivityLogSearch } from "@/lib/reports-dates";
import { reportsApi } from "@/lib/reports-api";
import type { ActivityLogCategory, ActivityLogItem } from "@/lib/reports-types";

const searchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.string().optional(),
  actorType: z.string().optional(),
  staffId: z.string().optional(),
  centreId: z.string().optional(),
  shiftId: z.string().optional(),
  page: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_authenticated/reports/activity")({
  validateSearch: (search) => searchSchema.parse(search),
  component: ActivityLogReport,
});

const CATEGORY_ICONS: Record<ActivityLogCategory, typeof ClipboardList> = {
  shifts: ClipboardList,
  staff: Users,
  documents: FileText,
  communications: MessageSquare,
  centres: Building2,
  users: User,
  system: Settings,
};

function actorLabel(item: ActivityLogItem): string {
  if (item.actor.name) return item.actor.name;
  if (item.actor.type === "system") return "System";
  if (item.actor.type === "unknown") return "Unknown";
  return "Recorded before actor auditing";
}

function ActivityDetail({ item }: { item: ActivityLogItem }) {
  const metadata = item.metadata;
  if (!metadata) return null;

  const changes =
    metadata.changes && typeof metadata.changes === "object"
      ? (metadata.changes as Record<string, { from?: unknown; to?: unknown }>)
      : null;
  const cancellationPreview =
    typeof metadata.cancellationReasonPreview === "string"
      ? metadata.cancellationReasonPreview
      : null;

  if (!changes && !cancellationPreview) return null;

  return (
    <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
      {changes
        ? Object.entries(changes).map(([field, value]) => (
            <p key={field}>
              <span className="font-medium capitalize">{field.replace(/([A-Z])/g, " $1")}: </span>
              {String(value.from ?? "—")} → {String(value.to ?? "—")}
            </p>
          ))
        : null}
      {cancellationPreview ? (
        <p>
          <span className="font-medium">Cancellation reason: </span>
          {cancellationPreview}
        </p>
      ) : null}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityLogItem }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = CATEGORY_ICONS[item.category];
  const hasDetails = Boolean(
    item.metadata?.changes ||
      item.metadata?.cancellationReasonPreview ||
      item.metadata?.previousStaffId ||
      item.metadata?.newStaffId,
  );

  return (
    <Card className="border-border/70 shadow-xs">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="font-medium">{item.title}</p>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.category}
                </span>
              </div>
              {item.description ? (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">Actor: {actorLabel(item)}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                {item.staff ? (
                  <Link to="/staff/$id" params={{ id: item.staff.id }} className="text-primary hover:underline">
                    Staff: {item.staff.name}
                  </Link>
                ) : null}
                {item.centre ? (
                  <Link
                    to="/centres/$id"
                    params={{ id: item.centre.id }}
                    className="text-primary hover:underline"
                  >
                    Centre: {item.centre.name}
                  </Link>
                ) : null}
                {item.shift ? (
                  <Link
                    to="/shifts/$id"
                    params={{ id: item.shift.id }}
                    className="text-primary hover:underline"
                  >
                    Shift: {item.shift.shiftDate}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-sm text-muted-foreground sm:text-right">
            <time dateTime={item.occurredAt}>{formatOpsDateTimeToronto(item.occurredAt)}</time>
          </div>
        </div>

        {hasDetails ? (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="h-8 px-2"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? (
                <>
                  Hide details
                  <ChevronUp className="ml-1 h-4 w-4" aria-hidden="true" />
                </>
              ) : (
                <>
                  Show details
                  <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
            {expanded ? <ActivityDetail item={item} /> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActivityLogReport() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const defaults = defaultActivityLogSearch();

  const applied = useMemo(
    () => ({
      dateFrom: search.dateFrom ?? defaults.dateFrom,
      dateTo: search.dateTo ?? defaults.dateTo,
      category: search.category ?? "all",
      actorType: search.actorType ?? "all",
      staffId: search.staffId ?? "all",
      centreId: search.centreId ?? "all",
      page: search.page ?? 1,
    }),
    [search, defaults.dateFrom, defaults.dateTo],
  );

  const [dateFrom, setDateFrom] = useState(applied.dateFrom);
  const [dateTo, setDateTo] = useState(applied.dateTo);
  const [category, setCategory] = useState(applied.category);
  const [actorType, setActorType] = useState(applied.actorType);
  const [staffId, setStaffId] = useState(applied.staffId);
  const [centreId, setCentreId] = useState(applied.centreId);

  const staffQ = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => staffApi.list(),
  });
  const centresQ = useQuery({
    queryKey: ["centres-all"],
    queryFn: () => centresApi.list(),
  });

  const reportQ = useQuery({
    queryKey: [
      "reports-activity",
      applied.dateFrom,
      applied.dateTo,
      applied.category,
      applied.actorType,
      applied.staffId,
      applied.centreId,
      applied.page,
    ],
    queryFn: () =>
      reportsApi.activityLog({
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        category: applied.category === "all" ? undefined : applied.category,
        actorType: applied.actorType === "all" ? undefined : applied.actorType,
        staffId: applied.staffId === "all" ? undefined : applied.staffId,
        centreId: applied.centreId === "all" ? undefined : applied.centreId,
        page: applied.page,
      }),
  });

  function applyFilters() {
    navigate({
      search: {
        dateFrom,
        dateTo,
        category: category === "all" ? undefined : category,
        actorType: actorType === "all" ? undefined : actorType,
        staffId: staffId === "all" ? undefined : staffId,
        centreId: centreId === "all" ? undefined : centreId,
        page: 1,
      },
    });
  }

  function resetFilters() {
    const next = defaultActivityLogSearch();
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setCategory("all");
    setActorType("all");
    setStaffId("all");
    setCentreId("all");
    navigate({ search: {} });
  }

  const rangeLabel = reportQ.data
    ? `${formatOpsDateToronto(reportQ.data.dateFrom)} – ${formatOpsDateToronto(reportQ.data.dateTo)}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        subtitle="Review recorded Staff, Shift, document, communication, and administrative activity."
        actions={
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All reports
          </Link>
        }
      />

      <Alert className="border-border/70 bg-muted/20">
        <AlertDescription>
          Activity history is based on events recorded by the platform. Some actions performed before
          expanded audit tracking was introduced may not appear here.
        </AlertDescription>
      </Alert>

      <ActivityLogFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        category={category}
        actorType={actorType}
        staffId={staffId}
        centreId={centreId}
        staff={staffQ.data ?? []}
        centres={centresQ.data ?? []}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onCategoryChange={setCategory}
        onActorTypeChange={setActorType}
        onStaffChange={setStaffId}
        onCentreChange={setCentreId}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {rangeLabel ? (
        <p className="text-sm text-muted-foreground">
          Showing {rangeLabel}
          {reportQ.data ? ` · ${reportQ.data.totalCount} events` : ""}
        </p>
      ) : null}

      {reportQ.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {reportQ.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Unable to load activity log. Please try again.
          </CardContent>
        </Card>
      ) : null}

      {reportQ.data ? (
        <div className="space-y-3">
          {reportQ.data.items.length === 0 ? (
            <Card className="border-border/70 shadow-xs">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No recorded activity matches the selected filters.
              </CardContent>
            </Card>
          ) : (
            reportQ.data.items.map((item) => <ActivityRow key={item.id} item={item} />)
          )}
        </div>
      ) : null}

      {reportQ.data && reportQ.data.totalCount > reportQ.data.pageSize ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {reportQ.data.page} · {reportQ.data.items.length} of {reportQ.data.totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={reportQ.data.page <= 1}
              onClick={() =>
                navigate({
                  search: {
                    ...search,
                    page: Math.max(1, (search.page ?? 1) - 1),
                  },
                })
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={!reportQ.data.hasMore}
              onClick={() =>
                navigate({
                  search: {
                    ...search,
                    page: (search.page ?? 1) + 1,
                  },
                })
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
