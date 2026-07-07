import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, displayStaff, fmtTime } from "@/lib/db";
import { CentreForm } from "@/components/CentreForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiStaffSelect } from "@/components/MultiStaffSelect";
import { toast } from "sonner";
import { Star, Ban, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/centres/$id")({
  component: CentreDetail,
});

function CentreDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const centreQ = useQuery({
    queryKey: ["centre", id],
    queryFn: async () => (await db.from("centres").select("*").eq("id", id).single()).data,
  });
  const topQ = useQuery({
    queryKey: ["centre-top", id],
    queryFn: async () => {
      const { data } = await db.from("staff_centre_top").select("staff_id, staff:staff_id(id, legal_name, display_name, use_display_name)").eq("centre_id", id);
      return data ?? [];
    },
  });
  const bannedQ = useQuery({
    queryKey: ["centre-banned", id],
    queryFn: async () => {
      const { data } = await db.from("staff_centre_banned").select("staff_id, staff:staff_id(id, legal_name, display_name, use_display_name)").eq("centre_id", id);
      return data ?? [];
    },
  });
  const shiftsQ = useQuery({
    queryKey: ["centre-shifts", id],
    queryFn: async () => (await db.from("shifts").select("id, shift_date, start_time, end_time, status, role_needed, assigned_staff_id, staff:assigned_staff_id(legal_name, display_name, use_display_name)").eq("centre_id", id).order("shift_date", { ascending: false })).data ?? [],
  });

  if (!centreQ.data) return <div>Loading...</div>;
  const centre = centreQ.data;
  const topIds = (topQ.data ?? []).map((r: any) => r.staff_id);
  const bannedIds = (bannedQ.data ?? []).map((r: any) => r.staff_id);
  const now = new Date();

  async function deleteCentre() {
    const { error } = await db.from("centres").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Centre deleted");
    navigate({ to: "/centres" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/centres" className="text-sm text-muted-foreground hover:underline">&larr; Centres</Link>
          <h1 className="text-2xl font-semibold mt-1">{centre.name}</h1>
          <p className="text-sm text-muted-foreground">{centre.address}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm"><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this centre?</AlertDialogTitle>
              <AlertDialogDescription>This removes the centre and its Top/Banned staff lists. Existing shifts referencing it will block deletion.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteCentre}>Delete centre</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="staff-lists">Top &amp; Banned Staff</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <Card>
            <CardHeader><CardTitle>Edit centre details</CardTitle></CardHeader>
            <CardContent>
              <CentreForm
                initial={centre}
                onSubmit={async (values) => {
                  const { error } = await db.from("centres").update(values).eq("id", id);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Centre saved");
                  qc.invalidateQueries({ queryKey: ["centre", id] });
                  qc.invalidateQueries({ queryKey: ["centres"] });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff-lists" className="pt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" /> Top Staff</CardTitle></CardHeader>
            <CardContent>
              <MultiStaffSelect
                selectedIds={topIds}
                excludeIds={bannedIds}
                onChange={async (newIds) => {
                  const toAdd = newIds.filter(x => !topIds.includes(x));
                  const toRemove = topIds.filter((x: string) => !newIds.includes(x));
                  if (toAdd.length) {
                    await db.from("staff_centre_top").insert(toAdd.map(sid => ({ centre_id: id, staff_id: sid })));
                    await db.from("staff_centre_banned").delete().eq("centre_id", id).in("staff_id", toAdd);
                  }
                  if (toRemove.length) await db.from("staff_centre_top").delete().eq("centre_id", id).in("staff_id", toRemove);
                  qc.invalidateQueries({ queryKey: ["centre-top", id] });
                  qc.invalidateQueries();
                  toast.success("Top staff updated");
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" /> Banned Staff</CardTitle></CardHeader>
            <CardContent>
              <MultiStaffSelect
                selectedIds={bannedIds}
                excludeIds={topIds}
                onChange={async (newIds) => {
                  const toAdd = newIds.filter(x => !bannedIds.includes(x));
                  const toRemove = bannedIds.filter((x: string) => !newIds.includes(x));
                  if (toAdd.length) {
                    await db.from("staff_centre_banned").insert(toAdd.map(sid => ({ centre_id: id, staff_id: sid })));
                    await db.from("staff_centre_top").delete().eq("centre_id", id).in("staff_id", toAdd);
                  }
                  if (toRemove.length) await db.from("staff_centre_banned").delete().eq("centre_id", id).in("staff_id", toRemove);
                  qc.invalidateQueries({ queryKey: ["centre-banned", id] });
                  qc.invalidateQueries();
                  toast.success("Banned staff updated");
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="pt-4">
          <Card>
            <CardHeader><CardTitle>All shifts at this centre</CardTitle></CardHeader>
            <CardContent>
              {(shiftsQ.data ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No shifts recorded for this centre.</div>
              ) : (
                <div className="divide-y">
                  {(shiftsQ.data ?? []).map((s: any) => {
                    const isPast = new Date(s.shift_date + "T" + s.end_time) < now;
                    return (
                      <Link key={s.id} to="/shifts/$id" params={{ id: s.id }} className="flex items-center justify-between py-2 hover:bg-muted/50 px-2 -mx-2 rounded">
                        <div>
                          <div className="text-sm font-medium">{s.shift_date} · {fmtTime(s.start_time)} – {fmtTime(s.end_time)}</div>
                          <div className="text-xs text-muted-foreground">{s.role_needed || "No role"} · {s.staff ? displayStaff(s.staff) : "Unassigned"}</div>
                        </div>
                        <Badge variant={s.status === "filled" ? "default" : s.status === "pending" ? "secondary" : "outline"}>
                          {isPast ? "Past" : "Upcoming"} · {s.status}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
