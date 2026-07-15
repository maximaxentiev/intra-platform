import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, displayStaff, fmtTime, saveCentreSecondaryChannels, type CentreChannel } from "@/lib/db";
import { CentreForm } from "@/components/CentreForm";
import { CentreContactsEditor } from "@/components/CentreContactsEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiStaffSelect } from "@/components/MultiStaffSelect";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Star, Ban, Trash2, MapPin } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { z } from "zod";

const searchSchema = z.object({
  tab: z.enum(["details", "staff-lists", "shifts"]).optional(),
});

export const Route = createFileRoute("/_authenticated/centres/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  component: CentreDetail,
});

function CentreDetail() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const activeTab = tab ?? "details";

  const centreQ = useQuery({
    queryKey: ["centre", id],
    queryFn: async () => (await db.from("centres").select("*").eq("id", id).single()).data,
  });
  const secondaryQ = useQuery({
    queryKey: ["centre-secondary-channels", id],
    queryFn: async () =>
      ((await db.from("centre_secondary_channels").select("channel").eq("centre_id", id)).data ?? []).map(
        (r: { channel: CentreChannel }) => r.channel,
      ),
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
      <PageHeader
        eyebrow="Centre"
        backTo="/centres"
        backLabel="Back to Centres"
        title={centre.name}
        subtitle={
          centre.address ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {centre.address}
            </span>
          ) : "No address on file"
        }
        actions={
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
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={v => navigate({ to: "/centres/$id", params: { id }, search: { tab: v === "details" ? undefined : v } })}
      >
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="staff-lists">Top &amp; Banned Staff</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
        </TabsList>


        <TabsContent value="details" className="pt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Edit centre details</CardTitle></CardHeader>
            <CardContent>
              <CentreForm
                initial={centre}
                secondaryChannels={secondaryQ.data ?? []}
                onSubmit={async (values, secondary) => {
                  const payload = { ...values, preferred_channel: values.primary_channel };
                  const { error } = await db.from("centres").update(payload).eq("id", id);
                  if (error) { toast.error(error.message); return; }
                  try {
                    await saveCentreSecondaryChannels(id, secondary);
                  } catch (e: any) {
                    toast.error(e.message);
                    return;
                  }
                  toast.success("Centre saved");
                  qc.invalidateQueries({ queryKey: ["centre", id] });
                  qc.invalidateQueries({ queryKey: ["centre-secondary-channels", id] });
                  qc.invalidateQueries({ queryKey: ["centres"] });
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <CentreContactsEditor centreId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff-lists" className="pt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Star className="h-4 w-4 text-warning fill-warning" /> Top Staff</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Ban className="h-4 w-4 text-destructive" /> Banned Staff</CardTitle></CardHeader>
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
                    const isPastDue = new Date(`${s.shift_date}T${s.end_time}`) < now;
                    return (
                      <Link
                        key={s.id}
                        to="/shifts/$id"
                        params={{ id: s.id }}
                        className={`flex items-center justify-between py-2 hover:bg-muted/50 px-2 -mx-2 rounded ${isPastDue ? "opacity-75 text-muted-foreground" : ""}`}
                      >
                        <div>
                          <div className="text-sm font-medium">{s.shift_date} · {fmtTime(s.start_time)} – {fmtTime(s.end_time)}</div>
                          <div className="text-xs text-muted-foreground">{s.role_needed || "No role"} · {s.staff ? displayStaff(s.staff) : "Unassigned"}</div>
                        </div>
                        <StatusBadge status={s.status}>{s.status}</StatusBadge>
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

