import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { shiftsApi, toDateStr } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { SearchableCentreSelect } from "@/components/SearchableCentreSelect";
import { PageHeader } from "@/components/PageHeader";
import { BackLink, SectionCard } from "@/components/ui-kit";
import { Info } from "lucide-react";
import { NEW_SHIFT_ROLE_OPTIONS } from "@/lib/shift-role-ui";

const STAFFPOINT_HELP =
  "Whether this shift has also been posted to Staffpoint, the external staffing marketplace.";

export const Route = createFileRoute("/_authenticated/shifts/new")({
  component: NewShift,
});

function FieldGroup({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function NewShift() {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    centreId: "",
    shiftDate: toDateStr(new Date()),
    startTime: "08:00",
    endTime: "16:00",
    roleNeeded: "",
    addedToStaffpoint: false,
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.centreId) { toast.error("Please pick a centre"); return; }
    if (!values.roleNeeded) { toast.error("Please pick a role"); return; }
    setSaving(true);
    try {
      const created = await shiftsApi.create({
        centreId: values.centreId,
        shiftDate: values.shiftDate,
        startTime: values.startTime + ":00",
        endTime: values.endTime + ":00",
        roleNeeded: values.roleNeeded,
        addedToStaffpoint: !!values.addedToStaffpoint,
      });
      toast.success("Shift created");
      navigate({ to: "/shifts/$id", params: { id: created.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[740px] space-y-6">
      <BackLink to="/shifts" label="Back to Shifts" />
      <PageHeader
        title="Create shift"
        subtitle="Create the shift first, then find and assign staff on the next screen."
      />

      <SectionCard id="create-shift">
        <form onSubmit={submit} className="space-y-6">
          <FieldGroup legend="Where">
            <div className="space-y-2">
              <Label>Centre *</Label>
              <SearchableCentreSelect value={values.centreId} onChange={(v) => set("centreId", v)} />
            </div>
          </FieldGroup>

          <FieldGroup legend="When">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="d">Date *</Label>
                <Input id="d" type="date" required value={values.shiftDate} onChange={(e) => set("shiftDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st">Start time *</Label>
                <Input id="st" type="time" required value={values.startTime} onChange={(e) => set("startTime", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="et">End time *</Label>
                <Input id="et" type="time" required value={values.endTime} onChange={(e) => set("endTime", e.target.value)} />
              </div>
            </div>
          </FieldGroup>

          <FieldGroup legend="Requirements">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role required *</Label>
                <Select value={values.roleNeeded || undefined} onValueChange={(v) => set("roleNeeded", v)} required>
                  <SelectTrigger aria-label="Role required"><SelectValue placeholder="Choose role..." /></SelectTrigger>
                  <SelectContent>
                    {NEW_SHIFT_ROLE_OPTIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Added to Staffpoint</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        aria-label={`About Staffpoint. ${STAFFPOINT_HELP}`}
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">{STAFFPOINT_HELP}</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={values.addedToStaffpoint ? "yes" : "no"}
                  onValueChange={(v) => set("addedToStaffpoint", v === "yes")}
                >
                  <SelectTrigger aria-label="Added to Staffpoint"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FieldGroup>

          <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create shift"}</Button>
        </form>
      </SectionCard>
    </div>
  );
}
