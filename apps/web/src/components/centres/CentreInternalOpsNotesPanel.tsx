import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { centresApi } from "@/lib/db";
import { cn } from "@/lib/utils";

type CentreInternalOpsNotesPanelProps = {
  centreId: string;
  className?: string;
};

/**
 * Read-only Ops-only centre notes shown while creating shifts/batches.
 * Hidden when the centre has no internal notes.
 */
export function CentreInternalOpsNotesPanel({ centreId, className }: CentreInternalOpsNotesPanelProps) {
  const { data: centres } = useQuery({
    queryKey: ["centres-all"],
    queryFn: () => centresApi.list(),
  });

  const notes = (centres ?? []).find((centre) => centre.id === centreId)?.internalOpsNotes?.trim();
  if (!notes) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-info/30 bg-info-soft px-4 py-3.5",
        className,
      )}
      role="note"
      aria-label="Internal Ops Notes"
    >
      <div className="flex gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
        <div className="min-w-0 space-y-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Internal Ops Notes</p>
            <p className="text-xs text-muted-foreground">For the Intra Ops team only</p>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{notes}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Read-only panel for Centre Details when internal notes exist.
 */
export function CentreInternalOpsNotesReadPanel({
  notes,
  className,
}: {
  notes: string;
  className?: string;
}) {
  const trimmed = notes.trim();
  if (!trimmed) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-info/30 bg-info-soft px-4 py-3.5",
        className,
      )}
      role="note"
      aria-label="Internal Ops Notes"
    >
      <div className="flex gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
        <div className="min-w-0 space-y-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Internal Ops Notes</p>
            <p className="text-xs text-muted-foreground">
              Visible to the Intra Ops team only. Never shared with Centres or Carers.
            </p>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{trimmed}</p>
        </div>
      </div>
    </div>
  );
}
