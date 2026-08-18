import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { centresApi, displayStaff, fmtTime, saveCentreSecondaryChannels } from "@/lib/db";
import { CentreForm } from "@/components/CentreForm";
import { CentreContactsEditor } from "@/components/CentreContactsEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiStaffSelect } from "@/components/MultiStaffSelect";
import { PageHeader } from "@/components/PageHeader";
import { DetailLoading } from "@/components/DetailLoading";
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
    queryFn: () => centresApi.get(id),
  });
  const secondaryQ = useQuery({
    queryKey: ["centre-secondary-channels", id],
    queryFn: () => centresApi.secondaryChannels(id),
  });
  const topQ = useQuery({
    queryKey: ["centre-top", id],
    queryFn: () => centresApi.topStaff(id),
  });
  const bannedQ = useQuery({
    queryKey: ["centre-banned", id],
    queryFn: () => centresApi.bannedStaff(id),
  });
  const shiftsQ = useQuery({
    queryKey: ["centre-shifts", id],
    queryFn: () => centresApi.shifts(id),
  });

  if (!centreQ.data) return <DetailLoading />;
  const centre = centreQ.data;
  const topIds = (topQ.data ?? []).map((r) => r.staffId);
  const bannedIds = (bannedQ.data ?? []).map((r) => r.staffId);
  const now = new Date();

  async function deleteCentre() {
    try {
      await centresApi.remove(id);
      toast.success("Centre deleted");
      navigate({ to: "/centres" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
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
        onValueChange={v => navigate({ to: "/centres/$id", params: { id }, search: { tab: v === "details" ? undefined : (v as "staff-lists" | "shifts") } })}
      >
        <div className="-mx-4 sm:mx-0 overflow-x-auto no-scrollbar px-4 sm:px-0">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="staff-lists">Top &amp; Banned Staff</TabsTrigger>
            <TabsTrigger value="shifts">Shifts</TabsTrigger>
          </TabsList>
        </div>



        <TabsContent value="details" className="pt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Edit centre details</CardTitle></CardHeader>
            <CardContent>
              <CentreForm
                initial={centre}
                secondaryChannels={secondaryQ.data ?? []}
                onSubmit={async (values, secondary) => {
                  try {
                    await centresApi.update(id, {
                      ...values,
                      hourlyRate: values.hourlyRate.trim() ? values.hourlyRate.trim() : null,
                    });
                    await saveCentreSecondaryChannels(id, secondary);
                    toast.success("Centre saved");
                    qc.invalidateQueries({ queryKey: ["centre", id] });
                    qc.invalidateQueries({ queryKey: ["centre-secondary-channels", id] });
                    qc.invalidateQueries({ queryKey: ["centres"] });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Save failed");
                  }
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
                  try {
                    await centresApi.setTopStaff(id, newIds);
                    qc.invalidateQueries();
                    toast.success("Top staff updated");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Update failed");
                  }
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
                  try {
                    await centresApi.setBannedStaff(id, newIds);
                    qc.invalidateQueries();
                    toast.success("Banned staff updated");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Update failed");
                  }
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
                  {(shiftsQ.data ?? []).map((s) => {
                    const isPastDue = new Date(`${s.shiftDate}T${s.endTime}`) < now;
                    const assigned = s.assignedStaffId && s.assignedLegalName
                      ? displayStaff({
                          legalName: s.assignedLegalName,
                          displayName: s.assignedDisplayName ?? "",
                          useDisplayName: s.assignedUseDisplayName ?? false,
                        })
                      : "Unassigned";
                    return (
                      <Link
                        key={s.id}
                        to="/shifts/$id"
                        params={{ id: s.id }}
                        className={`flex items-center justify-between py-2 hover:bg-muted/50 px-2 -mx-2 rounded ${isPastDue ? "opacity-75 text-muted-foreground" : ""}`}
                      >
                        <div>
                          <div className="text-sm font-medium">{s.shiftDate} · {fmtTime(s.startTime)} – {fmtTime(s.endTime)}</div>
                          <div className="text-xs text-muted-foreground">{s.roleNeeded || "No role"} · {assigned}</div>
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
