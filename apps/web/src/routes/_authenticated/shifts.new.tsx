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
import { ShiftNotesField } from "@/components/shifts/ShiftNotesField";
import {
  clearIndividualShiftCreatePrefill,
  readIndividualShiftCreatePrefill,
} from "@/lib/batch-shift-ui";
import { NEW_SHIFT_ROLE_OPTIONS } from "@/lib/shift-role-ui";

const STAFFPOINT_HELP =
  "Whether this shift has also been posted to Staffpoint, the external staffing marketplace.";

function initialCreateValues() {
  const prefill = readIndividualShiftCreatePrefill();
  if (prefill) {
    clearIndividualShiftCreatePrefill();
    return {
      centreId: prefill.centreId,
      shiftDate: prefill.shiftDate || toDateStr(new Date()),
      startTime: prefill.startTime || "08:00",
      endTime: prefill.endTime || "16:00",
      roleNeeded: prefill.roleNeeded,
      addedToStaffpoint: prefill.addedToStaffpoint,
      confirmationNotes: prefill.confirmationNotes,
      pendingInternalComment: prefill.pendingInternalComment ?? "",
    };
  }
  return {
    centreId: "",
    shiftDate: toDateStr(new Date()),
    startTime: "08:00",
    endTime: "16:00",
    roleNeeded: "",
    addedToStaffpoint: false,
    confirmationNotes: "",
    pendingInternalComment: "",
  };
}

export const Route = createFileRoute("/_authenticated/shifts/new")({
  component: NewShift,
});

function NewShift() {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialCreateValues);
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
        confirmationNotes: values.confirmationNotes.trim() || undefined,
      });
      const pendingComment = values.pendingInternalComment.trim();
      if (pendingComment) {
        try {
          await shiftsApi.addComment(created.id, pendingComment);
        } catch {
          toast.warning("Shift created, but the internal comment could not be saved.");
          navigate({ to: "/shifts/$id", params: { id: created.id } });
          return;
        }
      }
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
          <div className="space-y-2">
            <Label>Centre *</Label>
            <SearchableCentreSelect value={values.centreId} onChange={(v) => set("centreId", v)} />
          </div>

          <div className="border-t border-border/70 pt-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="shift-date">Date *</Label>
                <Input
                  id="shift-date"
                  type="date"
                  value={values.shiftDate}
                  onChange={(e) => set("shiftDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-start">Start *</Label>
                <Input
                  id="shift-start"
                  type="time"
                  value={values.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-end">End *</Label>
                <Input
                  id="shift-end"
                  type="time"
                  value={values.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={values.roleNeeded || undefined} onValueChange={(v) => set("roleNeeded", v)}>
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
                <Label>Staffpoint</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

          <ShiftNotesField
            id="create-shift-notes"
            value={values.confirmationNotes}
            onChange={(v) => set("confirmationNotes", v)}
          />

          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create shift"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
