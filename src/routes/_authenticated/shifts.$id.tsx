import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { db, displayStaff, fmtTime, type ShiftStatus } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Star, Trash2, UserCheck, XCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SearchableCentreSelect } from "@/components/SearchableCentreSelect";
import { ShiftComments } from "@/components/ShiftComments";
import { PageHeader } from "@/components/PageHeader";
import { DetailLoading } from "@/components/DetailLoading";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/shifts/$id")({
  component: ShiftDetail,
});

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

function ShiftDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const shiftQ = useQuery({
    queryKey: ["shift", id],
    queryFn: async () => (await db.from("shifts").select("*, centre:centre_id(id, name), staff:assigned_staff_id(id, legal_name, display_name, use_display_name)").eq("id", id).single()).data,
  });

  const shift = shiftQ.data;

  const bannedQ = useQuery({
    enabled: !!shift,
    queryKey: ["shift-banned", shift?.centre_id],
    queryFn: async () => (await db.from("staff_centre_banned").select("staff_id").eq("centre_id", shift.centre_id)).data ?? [],
  });
  const topQ = useQuery({
    enabled: !!shift,
    queryKey: ["shift-top", shift?.centre_id],
    queryFn: async () => (await db.from("staff_centre_top").select("staff_id").eq("centre_id", shift.centre_id)).data ?? [],
  });
  const staffQ = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => (await db.from("staff").select("id, legal_name, display_name, use_display_name, role").eq("status", "active").order("legal_name")).data ?? [],
  });
  const overlapQ = useQuery({
    enabled: !!shift,
    queryKey: ["shift-overlap", shift?.shift_date, id],
    queryFn: async () =>
      (await db.from("shifts").select("id, assigned_staff_id, start_time, end_time").eq("shift_date", shift.shift_date).neq("id", id).not("assigned_staff_id", "is", null)).data ?? [],
  });
  const contactedQ = useQuery({
    queryKey: ["shift-contacted", id],
    queryFn: async () => (await db.from("shift_contacted").select("staff_id").eq("shift_id", id)).data ?? [],
  });

  const availableList = useMemo(() => {
    if (!shift) return [];
    const bannedIds = new Set((bannedQ.data ?? []).map((r: any) => r.staff_id));
    const topIds = new Set((topQ.data ?? []).map((r: any) => r.staff_id));
    const conflictIds = new Set(
      (overlapQ.data ?? [])
        .filter((s: any) => overlap(shift.start_time, shift.end_time, s.start_time, s.end_time))
        .map((s: any) => s.assigned_staff_id),
    );
    const eligible = (staffQ.data ?? []).filter(
      (s: any) => !bannedIds.has(s.id) && !conflictIds.has(s.id) && s.role === shift.role_needed,
    );
    const top = eligible.filter((s: any) => topIds.has(s.id)).sort((a: any, b: any) => displayStaff(a).localeCompare(displayStaff(b)));
    const rest = eligible.filter((s: any) => !topIds.has(s.id)).sort((a: any, b: any) => displayStaff(a).localeCompare(displayStaff(b)));
    return [...top.map((s: any) => ({ ...s, isTop: true })), ...rest.map((s: any) => ({ ...s, isTop: false }))];
  }, [shift, bannedQ.data, topQ.data, staffQ.data, overlapQ.data]);

  const contactedSet = new Set((contactedQ.data ?? []).map((r: any) => r.staff_id));

  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  if (!shift) return <DetailLoading />;
  const editVals = edit ?? {
    centre_id: shift.centre_id,
    shift_date: shift.shift_date,
    start_time: shift.start_time.slice(0, 5),
    end_time: shift.end_time.slice(0, 5),
    role_needed: shift.role_needed,
    notes: shift.notes,
    added_to_staffpoint: !!shift.added_to_staffpoint,
  };

  async function saveEdits() {
    const payload = { ...editVals, start_time: editVals.start_time + ":00", end_time: editVals.end_time + ":00" };
    const { error } = await db.from("shifts").update(payload).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Shift updated");
    setEditing(false);
    qc.invalidateQueries();
  }

  async function changeStatus(newStatus: ShiftStatus, reason?: string) {
    const patch: any = { status: newStatus };
    if (newStatus === "cancelled" && reason !== undefined) patch.cancellation_reason = reason;
    if (newStatus === "pending") patch.assigned_staff_id = null;
    const { error } = await db.from("shifts").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status changed to ${newStatus}`);
    qc.invalidateQueries();
  }

  async function assignStaff(staffId: string) {
    const { error } = await db.from("shifts").update({ assigned_staff_id: staffId, status: "filled" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Staff assigned");
    qc.invalidateQueries();
  }

  async function unassign() {
    const { error } = await db.from("shifts").update({ assigned_staff_id: null, status: "pending" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment cleared");
    qc.invalidateQueries();
  }

  async function toggleContacted(staffId: string) {
    if (contactedSet.has(staffId)) {
      await db.from("shift_contacted").delete().eq("shift_id", id).eq("staff_id", staffId);
    } else {
      await db.from("shift_contacted").insert({ shift_id: id, staff_id: staffId });
    }
    qc.invalidateQueries({ queryKey: ["shift-contacted", id] });
  }

  async function deleteShift() {
    const { error } = await db.from("shifts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Shift deleted");
    navigate({ to: "/shifts" });
  }


  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Shift"
        backTo="/shifts"
        backLabel="Back to Shifts"
        title={`${shift.centre?.name ?? "Shift"} · ${shift.shift_date}`}
        subtitle={`${fmtTime(shift.start_time)} – ${fmtTime(shift.end_time)} · ${shift.role_needed || "No role"}`}
        meta={<StatusBadge status={shift.status} size="md">{shift.status}</StatusBadge>}
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm"><Trash2 className="h-4 w-4 mr-2" /> Delete</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this shift?</AlertDialogTitle>
                <AlertDialogDescription>This permanently removes the shift record.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteShift}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />


      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Shift details</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setEditing(v => !v)}>{editing ? "Cancel" : "Edit"}</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {!editing ? (
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Centre:</span> {shift.centre?.name}</div>
                  <div><span className="text-muted-foreground">Date:</span> {shift.shift_date}</div>
                  <div><span className="text-muted-foreground">Time:</span> {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}</div>
                  <div><span className="text-muted-foreground">Role:</span> {shift.role_needed || "—"}</div>
                  <div><span className="text-muted-foreground">Notes:</span> {shift.notes || "—"}</div>
                  <div><span className="text-muted-foreground">Added to Staffpoint:</span> {shift.added_to_staffpoint ? "Yes" : "No"}</div>
                  <div><span className="text-muted-foreground">Assigned:</span> {shift.staff ? displayStaff(shift.staff) : <span className="italic">Unassigned</span>}
                    {shift.staff && <Button size="sm" variant="link" onClick={unassign}>Unassign</Button>}
                  </div>
                  {shift.status === "cancelled" && shift.cancellation_reason && (
                    <div><span className="text-muted-foreground">Cancellation reason:</span> {shift.cancellation_reason}</div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Centre</Label>
                    <SearchableCentreSelect
                      value={editVals.centre_id}
                      onChange={v => setEdit({ ...editVals, centre_id: v })}
                    />
                  </div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={editVals.shift_date} onChange={e => setEdit({ ...editVals, shift_date: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2"><Label>Start</Label><Input type="time" value={editVals.start_time} onChange={e => setEdit({ ...editVals, start_time: e.target.value })} /></div>
                    <div className="space-y-2"><Label>End</Label><Input type="time" value={editVals.end_time} onChange={e => setEdit({ ...editVals, end_time: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Role needed</Label>
                    <Select value={editVals.role_needed || undefined} onValueChange={v => setEdit({ ...editVals, role_needed: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose role..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ECA">ECA</SelectItem>
                        <SelectItem value="ECE">ECE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Notes</Label><Textarea rows={3} value={editVals.notes} onChange={e => setEdit({ ...editVals, notes: e.target.value })} /></div>
                  <div className="space-y-2">
                    <Label>Added to Staffpoint</Label>
                    <Select
                      value={editVals.added_to_staffpoint ? "yes" : "no"}
                      onValueChange={v => setEdit({ ...editVals, added_to_staffpoint: v === "yes" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={saveEdits}>Save changes</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Change status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Select value={shift.status} onValueChange={v => v === "cancelled" ? undefined : changeStatus(v as ShiftStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="filled" disabled={!shift.assigned_staff_id}>Filled (needs an assignee)</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <CancelShiftButton onCancel={(reason) => changeStatus("cancelled", reason)} />
              <p className="text-xs text-muted-foreground">Filled shifts are automatically marked Completed once their end time passes.</p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Available staff for this shift</CardTitle>
              <p className="text-sm text-muted-foreground">Banned staff and anyone already booked at this time are excluded. <Star className="inline h-3.5 w-3.5 text-warning fill-warning -mt-0.5" /> = Top staff for this centre.</p>
            </CardHeader>
            <CardContent>
              {availableList.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">No eligible staff. Everyone active is either banned at this centre or already booked at this time.</div>
              ) : (
                <ul className="divide-y">
                  {availableList.map((s: any) => {
                    const isAssigned = shift.assigned_staff_id === s.id;
                    return (
                    <li
                      key={s.id}
                      className={`flex items-center justify-between py-2.5 px-3 rounded-md transition-colors ${
                        isAssigned
                          ? "bg-success-soft border border-success/30 ring-1 ring-success/20"
                          : s.isTop
                            ? "bg-warning-soft/60"
                            : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {s.isTop && <Star className="h-4 w-4 text-warning fill-warning" />}
                        <div>
                          <div className={`text-sm font-medium ${isAssigned ? "text-success" : ""}`}>{displayStaff(s)}</div>
                          <div className="text-xs text-muted-foreground">{s.role || "No role"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <Checkbox checked={contactedSet.has(s.id)} onCheckedChange={() => toggleContacted(s.id)} />
                          Contacted
                        </label>
                        {isAssigned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success text-success-foreground px-3 py-1 text-xs font-medium">
                            <UserCheck className="h-3.5 w-3.5" />
                            Assigned
                          </span>
                        ) : (
                          <Button size="sm" onClick={() => assignStaff(s.id)}><UserCheck className="h-4 w-4 mr-1" /> Assign</Button>
                        )}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ShiftComments shiftId={id} />
    </div>
  );
}

function CancelShiftButton({ onCancel }: { onCancel: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full"><XCircle className="h-4 w-4 mr-2" /> Cancel this shift</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this shift?</AlertDialogTitle>
          <AlertDialogDescription>Optionally add a reason for internal records.</AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel>Keep shift</AlertDialogCancel>
          <AlertDialogAction onClick={() => { onCancel(reason); setOpen(false); }}>Cancel shift</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
