import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db, displayStaff, fmtTime, type ShiftStatus } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
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
    from !== "" ||
    to !== "" ||
    centreId !== "all" ||
    status !== "all" ||
    staffId !== "all" ||
    staffpoint !== "all";

  const centresQ = useQuery({
    queryKey: ["centres-all"],
    queryFn: async () => (await db.from("centres").select("id, name").order("name")).data ?? [],
  });
  const staffQ = useQuery({
    queryKey: ["staff-all"],
    queryFn: async () => (await db.from("staff").select("id, legal_name, display_name, use_display_name").order("legal_name")).data ?? [],
  });

  const { data } = useQuery({
    queryKey: ["shifts-list", from, to, centreId, status, staffId, staffpoint],
    queryFn: async () => {
      let q = db.from("shifts").select("*, centre:centre_id(name), staff:assigned_staff_id(legal_name, display_name, use_display_name)").order("shift_date", { ascending: false });
      if (from) q = q.gte("shift_date", from);
      if (to) q = q.lte("shift_date", to);
      if (centreId !== "all") q = q.eq("centre_id", centreId);
      if (status !== "all") q = q.eq("status", status);
      if (staffId !== "all") q = q.eq("assigned_staff_id", staffId);
      if (staffpoint === "yes") q = q.eq("added_to_staffpoint", true);
      if (staffpoint === "no") q = q.eq("added_to_staffpoint", false);
      return (await q).data ?? [];
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
    setFrom("");
    setTo("");
    setCentreId("all");
    setStatus("all");
    setStaffId("all");
    setStaffpoint("all");
    navigate({ search: {} });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shifts</h1>
          <p className="text-sm text-muted-foreground">All shifts across every centre.</p>
        </div>
        <Button asChild><Link to="/shifts/new"><Plus className="h-4 w-4 mr-2" /> Create shift</Link></Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium">From</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">To</label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Centre</label>
            <Select value={centreId} onValueChange={setCentreId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All centres</SelectItem>
                {(centresQ.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Status</label>
            <Select value={status} onValueChange={v => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="filled">Filled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Assigned to</label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                {(staffQ.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{displayStaff(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Staffpoint</label>
            <Select value={staffpoint} onValueChange={v => setStaffpoint(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 lg:col-span-2">
            <Button onClick={applyFilters}>Apply filters</Button>
            <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}>
              Clear filters
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Centre</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Staffpoint</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No shifts match your filters.</TableCell></TableRow>
            )}
            {(data ?? []).map((s: any) => {
              const isPastDue = new Date(`${s.shift_date}T${s.end_time}`) < new Date();
              return (
              <TableRow
                key={s.id}
                className={`cursor-pointer ${isPastDue ? "bg-muted/40 text-muted-foreground opacity-75" : ""}`}
                onClick={() => navigate({ to: "/shifts/$id", params: { id: s.id } } as any)}
              >
                <TableCell className="font-medium">{s.shift_date}</TableCell>
                <TableCell>{s.centre?.name}</TableCell>
                <TableCell>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</TableCell>
                <TableCell>{s.role_needed || "—"}</TableCell>
                <TableCell>{s.staff ? displayStaff(s.staff) : <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                <TableCell>{s.added_to_staffpoint ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "filled" ? "default" : s.status === "pending" ? "secondary" : s.status === "cancelled" ? "destructive" : "outline"}>
                    {s.status}
                  </Badge>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
