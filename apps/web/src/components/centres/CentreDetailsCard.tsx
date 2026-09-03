import { useState } from "react";
import { channelLabel, type Centre, type CentreChannel } from "@/lib/db";
import { centreLocationLabel, secondaryChannelsLabel } from "@/lib/centres-ui";
import { CentreForm, type CentreFormValues } from "@/components/CentreForm";
import { CentreInternalOpsNotesReadPanel } from "@/components/centres/CentreInternalOpsNotesPanel";
import { SectionCard, PropertyList } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";

/**
 * Read-first centre details. Editing is deliberate: the same form, the same
 * two-step save (centre fields, then secondary channels), shown only on demand.
 */
export function CentreDetailsCard({
  centre,
  secondaryChannels,
  onSave,
}: {
  centre: Centre;
  secondaryChannels: CentreChannel[];
  onSave: (values: CentreFormValues, secondary: CentreChannel[]) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <SectionCard>
        <CentreForm
          initial={centre}
          secondaryChannels={secondaryChannels}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (values, secondary) => {
            const ok = await onSave(values, secondary);
            if (ok) setEditing(false);
          }}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Centre Details"
      action={
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" aria-hidden /> Edit details
        </Button>
      }
    >
      <PropertyList
        items={[
          { label: "Centre name", value: centre.name },
          { label: "Location", value: centreLocationLabel(centre.address, centre.city) },
          {
            label: "Primary channel",
            value: (
              <Badge variant="secondary" className="font-normal">
                {channelLabel(centre.primaryChannel)}
              </Badge>
            ),
          },
          {
            label: "Secondary channels",
            value: secondaryChannelsLabel(secondaryChannels),
          },
        ]}
      />
      {centre.internalOpsNotes?.trim() ? (
        <CentreInternalOpsNotesReadPanel notes={centre.internalOpsNotes} className="mt-4" />
      ) : null}
      <div className="mt-4 border-t border-border/70 pt-3.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Rules &amp; notes
        </p>
        {centre.notes?.trim() ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{centre.notes}</p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            No rules or notes recorded. Carers assigned here see nothing extra.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
