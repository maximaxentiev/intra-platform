import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, displayStaff, fmtTime } from "@/lib/db";
import { StaffForm } from "@/components/StaffForm";
import { MultiCentreSelect } from "@/components/MultiCentreSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Star, Ban, Trash2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/$id")({
  component: StaffDetail,
});

function StaffDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const staffQ = useQuery({
    queryKey: ["staff", id],
    queryFn: async () => (await db.from("staff").select("*").eq("id", id).single()).data,
  });
  const topQ = useQuery({
    queryKey: ["staff-top", id],
    queryFn: async () => (await db.from("staff_centre_top").select("centre_id").eq("staff_id", id)).data ?? [],
  });
  const bannedQ = useQuery({
    queryKey: ["staff-banned", id],
    queryFn: async () => (await db.from("staff_centre_banned").select("centre_id").eq("staff_id", id)).data ?? [],
  });
  const shiftsQ = useQuery({
    queryKey: ["staff-shifts", id],
    queryFn: async () => (await db.from("shifts").select("id, shift_date, start_time, end_time, status, role_needed, centre_id, centre:centre_id(name)").eq("assigned_staff_id", id).order("shift_date", { ascending: false })).data ?? [],
  });

  if (!staffQ.data) return <div>Loading...</div>;
  const staff = staffQ.data;
  const topIds = (topQ.data ?? []).map((r: any) => r.centre_id);
  const bannedIds = (bannedQ.data ?? []).map((r: any) => r.centre_id);

  async function deleteStaff() {
    const { error } = await db.from("staff").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Staff deleted");
    navigate({ to: "/staff" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Staff"
        backTo="/staff"
        backLabel="Back to Staff"
        title={displayStaff(staff)}
        subtitle={staff.role || "No role set"}
        meta={<StatusBadge status={staff.status === "active" ? "active" : "inactive"}>{staff.status}</StatusBadge>}
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm"><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this staff member?</AlertDialogTitle>
                <AlertDialogDescription>This removes their profile, availability, and Top/Banned associations. Assigned shifts stay but the assignment becomes empty.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteStaff}>Delete staff</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />


      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="centres">Top &amp; Banned Centres</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact &amp; role</CardTitle></CardHeader>
            <CardContent>
              <StaffForm
                initial={staff}
                onSubmit={async (values) => {
                  const { error } = await db.from("staff").update(values).eq("id", id);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Staff saved");
                  qc.invalidateQueries();
                }}
              />
            </CardContent>
          </Card>
          {staff.documents_url && (
            <a href={staff.documents_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <ExternalLink className="h-4 w-4" /> Open compliance documents
            </a>
          )}
        </TabsContent>

        <TabsContent value="centres" className="pt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" /> Top Centres</CardTitle></CardHeader>
            <CardContent>
              <MultiCentreSelect
                selectedIds={topIds}
                excludeIds={bannedIds}
                onChange={async (newIds) => {
                  const toAdd = newIds.filter(x => !topIds.includes(x));
                  const toRemove = topIds.filter((x: string) => !newIds.includes(x));
                  if (toAdd.length) {
                    await db.from("staff_centre_top").insert(toAdd.map(cid => ({ staff_id: id, centre_id: cid })));
                    await db.from("staff_centre_banned").delete().eq("staff_id", id).in("centre_id", toAdd);
                  }
                  if (toRemove.length) await db.from("staff_centre_top").delete().eq("staff_id", id).in("centre_id", toRemove);
                  qc.invalidateQueries();
                  toast.success("Top centres updated");
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" /> Banned Centres</CardTitle></CardHeader>
            <CardContent>
              <MultiCentreSelect
                selectedIds={bannedIds}
                excludeIds={topIds}
                onChange={async (newIds) => {
                  const toAdd = newIds.filter(x => !bannedIds.includes(x));
                  const toRemove = bannedIds.filter((x: string) => !newIds.includes(x));
                  if (toAdd.length) {
                    await db.from("staff_centre_banned").insert(toAdd.map(cid => ({ staff_id: id, centre_id: cid })));
                    await db.from("staff_centre_top").delete().eq("staff_id", id).in("centre_id", toAdd);
                  }
                  if (toRemove.length) await db.from("staff_centre_banned").delete().eq("staff_id", id).in("centre_id", toRemove);
                  qc.invalidateQueries();
                  toast.success("Banned centres updated");
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability" className="pt-4">
          <AvailabilityEditor staffId={id} />
        </TabsContent>

        <TabsContent value="shifts" className="pt-4">
          <Card>
            <CardHeader><CardTitle>Shifts assigned</CardTitle></CardHeader>
            <CardContent>
              {(shiftsQ.data ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No shifts assigned yet.</div>
              ) : (
                <div className="divide-y">
                  {(shiftsQ.data ?? []).map((s: any) => (
                    <Link key={s.id} to="/shifts/$id" params={{ id: s.id }} className="flex items-center justify-between py-2 hover:bg-muted/50 px-2 -mx-2 rounded">
                      <div>
                        <div className="text-sm font-medium">{s.shift_date} · {fmtTime(s.start_time)} – {fmtTime(s.end_time)}</div>
                        <div className="text-xs text-muted-foreground">{s.centre?.name} · {s.role_needed || "No role"}</div>
                      </div>
                      <Badge variant={s.status === "filled" ? "default" : "outline"}>{s.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
