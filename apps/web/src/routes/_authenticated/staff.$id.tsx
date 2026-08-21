import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { staffApi, displayStaff } from "@/lib/db";
import { opsStaffDocumentsApi } from "@/lib/ops-staff-documents";
import { PortalAccountSection } from "@/components/PortalAccountSection";
import { StaffProfileCard } from "@/components/staff/StaffProfileCard";
import { StaffOperationalSummary } from "@/components/staff/StaffOperationalSummary";
import { StaffCentrePreferences } from "@/components/staff/StaffCentrePreferences";
import { StaffShiftsTab } from "@/components/staff/StaffShiftsTab";
import { StaffDocumentsSection } from "@/components/staff/StaffDocumentsSection";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { PageHeader } from "@/components/PageHeader";
import { DetailLoading } from "@/components/DetailLoading";
import { ConfirmDestructiveDialog } from "@/components/ui-kit";
import { toast } from "sonner";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/staff/$id")({
  component: StaffDetail,
});

function StaffDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

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
  const documentsQ = useQuery({
    queryKey: ["staff-documents", id],
    queryFn: () => opsStaffDocumentsApi.get(id),
  });

  if (!staffQ.data) return <DetailLoading />;
  const staff = staffQ.data;
  const topIds = topQ.data ?? [];
  const bannedIds = bannedQ.data ?? [];

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
    <div className="space-y-4">
      <PageHeader
        eyebrow="Staff"
        backTo="/staff"
        backLabel="Back to Staff"
        title={displayStaff(staff)}
        subtitle={[staff.role || "No role set", staff.city].filter(Boolean).join(" · ")}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="More staff actions">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Delete staff
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <ConfirmDestructiveDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this staff member?"
        consequence="This permanently removes their profile, availability, and centre preferences. Assigned shifts remain but lose this assignment."
        details="Deletion is only available before a carer portal account or invitation history exists. If they have portal access, disable it and set employment to inactive instead."
        confirmLabel="Delete staff"
        onConfirm={deleteStaff}
      />

      <StaffOperationalSummary
        employmentStatus={staff.status}
        portalAccount={staff.portalAccount ?? null}
        documentStatus={documentsQ.data?.documentStatus}
        documentsLoading={documentsQ.isLoading}
        documentsUnavailable={documentsQ.isError}
      />

      <Tabs defaultValue="profile">
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="centres">Centre preferences</TabsTrigger>
            <TabsTrigger value="shifts">Shifts</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="space-y-4 pt-4">
          <StaffProfileCard staff={staff} />
          <PortalAccountSection staffId={id} portalAccount={staff.portalAccount ?? null} />
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <StaffDocumentsSection
            staffId={id}
            documents={documentsQ.data}
            isLoading={documentsQ.isLoading}
            onRefresh={async () => {
              await documentsQ.refetch();
            }}
          />
        </TabsContent>

        <TabsContent value="availability" className="pt-4">
          <AvailabilityEditor staffId={id} />
        </TabsContent>

        <TabsContent value="centres" className="space-y-4 pt-4">
          <StaffCentrePreferences
            title="Top centres"
            description="Preferred placements. Prioritised when matching this carer to shifts."
            emptyText="No preferred centres yet."
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
          <StaffCentrePreferences
            title="Banned centres"
            description="This carer will not be matched to shifts at these centres."
            emptyText="No banned centres."
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
        </TabsContent>

        <TabsContent value="shifts" className="pt-4">
          <StaffShiftsTab staffId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
