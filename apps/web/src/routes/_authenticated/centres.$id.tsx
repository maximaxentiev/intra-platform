import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { centresApi, saveCentreSecondaryChannels } from "@/lib/db";
import { CentreDetailsCard } from "@/components/centres/CentreDetailsCard";
import { CentreContactsEditor } from "@/components/CentreContactsEditor";
import { CentreStaffPreferences } from "@/components/centres/CentreStaffPreferences";
import { CentreShiftsTab } from "@/components/centres/CentreShiftsTab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/PageHeader";
import { DetailLoading } from "@/components/DetailLoading";
import { BackLink, ConfirmDestructiveDialog } from "@/components/ui-kit";
import { toast } from "sonner";
import { AlertCircle, MoreHorizontal, Trash2 } from "lucide-react";
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
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  if (centreQ.isError) {
    return (
      <div className="space-y-6">
        <BackLink to="/centres" label="Back to Centres" />
        <PageHeader title="Centre unavailable" />
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">This centre could not be loaded</p>
            <p className="text-[13px] text-muted-foreground">
              It may have been deleted, or the request failed.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => void centreQ.refetch()}
            disabled={centreQ.isFetching}
          >
            {centreQ.isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </div>
    );
  }

  if (!centreQ.data) return <DetailLoading />;
  const centre = centreQ.data;
  const topIds = (topQ.data ?? []).map((r) => r.staffId);
  const bannedIds = (bannedQ.data ?? []).map((r) => r.staffId);

  async function deleteCentre() {
    try {
      await centresApi.remove(id);
      toast.success("Centre deleted");
      navigate({ to: "/centres" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <BackLink to="/centres" label="Back to Centres" />
      <PageHeader
        title={centre.name}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="More centre actions">
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
                <Trash2 className="h-4 w-4" aria-hidden /> Delete centre
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <ConfirmDestructiveDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this centre?"
        consequence="This permanently removes the centre, its contacts, and its Top/Banned staff lists."
        details="Deletion is blocked while shifts still reference this centre."
        confirmLabel="Delete centre"
        onConfirm={() => void deleteCentre()}
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          navigate({
            to: "/centres/$id",
            params: { id },
            search: { tab: v === "details" ? undefined : (v as "staff-lists" | "shifts") },
          })
        }
      >
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="staff-lists">Staff preferences</TabsTrigger>
            <TabsTrigger value="shifts">Shifts</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details" className="space-y-4 pt-4">
          <CentreDetailsCard
            centre={centre}
            secondaryChannels={secondaryQ.data ?? []}
            onSave={async (values, secondary) => {
              try {
                await centresApi.update(id, values);
                await saveCentreSecondaryChannels(id, secondary);
                toast.success("Centre saved");
                qc.invalidateQueries({ queryKey: ["centre", id] });
                qc.invalidateQueries({ queryKey: ["centre-secondary-channels", id] });
                qc.invalidateQueries({ queryKey: ["centres"] });
                return true;
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Save failed");
                return false;
              }
            }}
          />
          <CentreContactsEditor centreId={id} />
        </TabsContent>

        <TabsContent value="staff-lists" className="space-y-4 pt-4">
          <CentreStaffPreferences
            title="Top staff"
            description="Preferred staff. Prioritised when matching shifts at this centre."
            emptyText="No preferred staff yet."
            selectedIds={topIds}
            excludeIds={bannedIds}
            onChange={async (ids) => {
              try {
                await centresApi.setTopStaff(id, ids);
                qc.invalidateQueries({ queryKey: ["centre-top", id] });
                qc.invalidateQueries({ queryKey: ["centre-banned", id] });
                toast.success("Top staff updated");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Update failed");
              }
            }}
          />
          <CentreStaffPreferences
            title="Banned staff"
            description="These staff members will not be eligible for shifts at this centre."
            emptyText="No banned staff."
            selectedIds={bannedIds}
            excludeIds={topIds}
            onChange={async (ids) => {
              try {
                await centresApi.setBannedStaff(id, ids);
                qc.invalidateQueries({ queryKey: ["centre-top", id] });
                qc.invalidateQueries({ queryKey: ["centre-banned", id] });
                toast.success("Banned staff updated");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Update failed");
              }
            }}
          />
        </TabsContent>

        <TabsContent value="shifts" className="pt-4">
          <CentreShiftsTab centreId={id} centreName={centreQ.data?.name ?? "Centre"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
