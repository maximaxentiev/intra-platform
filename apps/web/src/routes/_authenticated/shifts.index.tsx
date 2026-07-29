import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { centresApi, staffApi, shiftsApi, displayStaff, fmtTime, type ShiftStatus } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, CalendarClock, X } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  centre: z.string().optional(),
  status: z.enum(["pending", "filled", "cancelled", "completed"]).optional(),
  staff: z.string().optional(),
  staffpoint: z.enum(["yes", "no"]).optional(),
});

export const Route = createFileRoute("/_authenticated/shifts/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ShiftsIndex,
});

function ShiftsIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [from, setFrom] = useState(search.from ?? "");
  const [to, setTo] = useState(search.to ?? "");
  const [centreId, setCentreId] = useState(search.centre ?? "all");
  const [status, setStatus] = useState<ShiftStatus | "all">((search.status ?? "all") as any);
  const [staffId, setStaffId] = useState(search.staff ?? "all");
  const [staffpoint, setStaffpoint] = useState<"all" | "yes" | "no">((search.staffpoint ?? "all") as any);

  const hasFilters =
    from !== "" || to !== "" || centreId !== "all" || status !== "all" ||
    staffId !== "all" || staffpoint !== "all";

  const centresQ = useQuery({
    queryKey: ["centres-all"],
    queryFn: () => centresApi.list(),
  });
  const staffQ = useQuery({
    queryKey: ["staff-all"],
    queryFn: () => staffApi.list(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["shifts-list", from, to, centreId, status, staffId, staffpoint],
    queryFn: async () => {
      const rows = await shiftsApi.list({
        from: from || undefined,
        to: to || undefined,
        centreId: centreId === "all" ? undefined : centreId,
        status: status === "all" ? undefined : status,
        staffId: staffId === "all" ? undefined : staffId,
      });
      if (staffpoint === "yes") return rows.filter((r) => r.addedToStaffpoint);
      if (staffpoint === "no") return rows.filter((r) => !r.addedToStaffpoint);
      return rows;
    },
  });

  function applyFilters() {
    navigate({
      search: {
        from: from || undefined,
        to: to || undefined,
        centre: centreId === "all" ? undefined : centreId,
        status: status === "all" ? undefined : status,
        staff: staffId === "all" ? undefined : staffId,
        staffpoint: staffpoint === "all" ? undefined : staffpoint,
      },
    });
  }

  function clearFilters() {
    setFrom(""); setTo(""); setCentreId("all"); setStatus("all");
    setStaffId("all"); setStaffpoint("all");
    navigate({ search: {} });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts"
        subtitle="All shifts across every centre."
        actions={
          <Button asChild>
            <Link to="/shifts/new"><Plus className="h-4 w-4 mr-1.5" /> Create shift</Link>
          </Button>
        }
      />

      <Card className="p-4 border-border/70 shadow-xs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-xs font-medium text-muted-foreground">Centre</Label>
            <Select value={centreId} onValueChange={setCentreId}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All centres</SelectItem>
                {(centresQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="filled">Filled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Assigned to</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                {(staffQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{displayStaff(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-xs font-medium text-muted-foreground">Staffpoint</Label>
            <Select value={staffpoint} onValueChange={(v) => setStaffpoint(v as any)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/70">
          <div className="text-xs text-muted-foreground">
            {isLoading ? "Loading…" : `${(data ?? []).length} shift${(data ?? []).length === 1 ? "" : "s"}`}
          </div>
          <div className="flex gap-2">
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters} size="sm">
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
            <Button onClick={applyFilters} size="sm">Apply filters</Button>
          </div>
        </div>
      </Card>


      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        {!isLoading && (data ?? []).length === 0 && (
          <Card className="p-8 text-center border-dashed">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary mb-3">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div className="text-sm font-medium">No shifts match your filters</div>
            <div className="text-xs text-muted-foreground mt-1">Adjust filters, or create a new shift.</div>
          </Card>
        )}
        {!isLoading && (data ?? []).map((s) => {
          const isPastDue = new Date(`${s.shiftDate}T${s.endTime}`) < new Date();
          const assigned = s.assignedStaffId && s.assignedLegalName
            ? displayStaff({
                legalName: s.assignedLegalName,
                displayName: s.assignedDisplayName ?? "",
                useDisplayName: s.assignedUseDisplayName ?? false,
              })
            : null;
          return (
            <Card
              key={s.id}
              className={`p-3 border-border/70 shadow-xs cursor-pointer active:bg-muted/40 ${isPastDue ? "opacity-70" : ""}`}
              onClick={() => navigate({ to: "/shifts/$id", params: { id: s.id } } as any)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{s.centreName}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {s.shiftDate} · {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {s.roleNeeded && <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">{s.roleNeeded}</span>}
                    <span className={assigned ? "text-foreground" : "text-muted-foreground italic"}>
                      {assigned ?? "Unassigned"}
                    </span>
                    {s.addedToStaffpoint && <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">· Staffpoint</span>}
                  </div>
                </div>
                <StatusBadge status={s.status}>{s.status}</StatusBadge>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop: table */}
      <Card className="hidden md:block border-border/70 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Centre</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead className="text-center">Staffpoint</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
              {!isLoading && (data ?? []).length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary mb-3">
                      <CalendarClock className="h-6 w-6" />
                    </div>
                    <div className="text-sm font-medium">No shifts match your filters</div>
                    <div className="text-xs text-muted-foreground mt-1">Adjust filters, or create a new shift.</div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (data ?? []).map((s) => {
                const isPastDue = new Date(`${s.shiftDate}T${s.endTime}`) < new Date();
                const assigned = s.assignedStaffId && s.assignedLegalName
                  ? displayStaff({
                      legalName: s.assignedLegalName,
                      displayName: s.assignedDisplayName ?? "",
                      useDisplayName: s.assignedUseDisplayName ?? false,
                    })
                  : null;
                return (
                  <TableRow
                    key={s.id}
                    className={`cursor-pointer transition-colors ${isPastDue ? "opacity-70" : ""}`}
                    onClick={() => navigate({ to: "/shifts/$id", params: { id: s.id } } as any)}
                  >
                    <TableCell className="font-medium tabular-nums">{s.shiftDate}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{s.centreName}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{fmtTime(s.startTime)} – {fmtTime(s.endTime)}</TableCell>
                    <TableCell>{s.roleNeeded || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {assigned
                        ? assigned
                        : <span className="text-muted-foreground italic">Unassigned</span>}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs">
                      {s.addedToStaffpoint ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status}>{s.status}</StatusBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

    </div>
  );
}
