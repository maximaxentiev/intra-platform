import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { staffApi, displayStaff, fmtTime, safeDocumentHref } from "@/lib/db";
import { StaffForm } from "@/components/StaffForm";
import { MultiCentreSelect } from "@/components/MultiCentreSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { PageHeader } from "@/components/PageHeader";
import { DetailLoading } from "@/components/DetailLoading";
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
    queryFn: () => staffApi.get(id),
  });
  const topQ = useQuery({
    queryKey: ["staff-top", id],
    queryFn: () => staffApi.topCentres(id),
  });
  const bannedQ = useQuery({
    queryKey: ["staff-banned", id],
    queryFn: () => staffApi.bannedCentres(id),
  });
  const shiftsQ = useQuery({
    queryKey: ["staff-shifts", id],
    queryFn: () => staffApi.shifts(id),
  });

  if (!staffQ.data) return <DetailLoading />;
  const staff = staffQ.data;
  const topIds = topQ.data ?? [];
  const bannedIds = bannedQ.data ?? [];
  const docsHref = safeDocumentHref(staff.documentsUrl);

  async function deleteStaff() {
    try {
      await staffApi.remove(id);
      toast.success("Staff deleted");
      navigate({ to: "/staff" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
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
        <div className="-mx-4 sm:mx-0 overflow-x-auto no-scrollbar px-4 sm:px-0">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="centres">Top &amp; Banned Centres</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="shifts">Shifts</TabsTrigger>
          </TabsList>
        </div>


        <TabsContent value="details" className="pt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact &amp; role</CardTitle></CardHeader>
            <CardContent>
              <StaffForm
                initial={staff}
                onSubmit={async (values) => {
                  try {
                    await staffApi.update(id, values);
                    toast.success("Staff saved");
                    qc.invalidateQueries();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Save failed");
                  }
                }}
              />
            </CardContent>
          </Card>
          {docsHref && (
            <a href={docsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <ExternalLink className="h-4 w-4" /> Open compliance documents
            </a>
          )}
        </TabsContent>

        <TabsContent value="centres" className="pt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Star className="h-4 w-4 text-warning fill-warning" /> Top Centres</CardTitle></CardHeader>
            <CardContent>
              <MultiCentreSelect
                selectedIds={topIds}
                excludeIds={bannedIds}
                onChange={async (newIds) => {
                  try {
                    await staffApi.setTopCentres(id, newIds);
                    qc.invalidateQueries();
                    toast.success("Top centres updated");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Update failed");
                  }
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
                  try {
                    await staffApi.setBannedCentres(id, newIds);
                    qc.invalidateQueries();
                    toast.success("Banned centres updated");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Update failed");
                  }
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
                  {(shiftsQ.data ?? []).map((s) => (
                    <Link key={s.id} to="/shifts/$id" params={{ id: s.id }} className="flex items-center justify-between py-2 hover:bg-muted/50 px-2 -mx-2 rounded">
                      <div>
                        <div className="text-sm font-medium">{s.shiftDate} · {fmtTime(s.startTime)} – {fmtTime(s.endTime)}</div>
                        <div className="text-xs text-muted-foreground">{s.centreName} · {s.roleNeeded || "No role"}</div>
                      </div>
                      <StatusBadge status={s.status}>{s.status}</StatusBadge>
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
