import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/ui-kit";
import { shiftsApi } from "@/lib/db";
import { toast } from "sonner";

type Props = {
  shiftId: string;
  notes: string;
};

export function ShiftInternalNotesCard({ shiftId, notes: initialNotes }: Props) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const dirty = notes !== initialNotes;

  async function saveNotes() {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      await shiftsApi.update(shiftId, { notes });
      toast.success("Internal notes saved");
      qc.invalidateQueries({ queryKey: ["shift", shiftId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save notes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard id="internal-notes" title="Internal notes">
      <p className="mb-3 text-[13px] text-muted-foreground">
        Ops-only notes. Not shared with Centres or Carers.
      </p>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="shift-internal-notes" className="sr-only">
            Internal notes
          </Label>
          <Textarea
            id="shift-internal-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes about this shift…"
          />
        </div>
        <Button size="sm" disabled={!dirty || saving} onClick={() => void saveNotes()}>
          {saving ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </SectionCard>
  );
}
