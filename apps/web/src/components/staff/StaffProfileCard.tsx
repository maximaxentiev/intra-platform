import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { staffApi, type StaffDetail } from "@/lib/db";
import { StaffForm } from "@/components/StaffForm";
import { Button } from "@/components/ui/button";
import { PropertyList, SectionCard } from "@/components/ui-kit";
import { Pencil } from "lucide-react";

/**
 * Staff profile: read mode by default, existing StaffForm on demand.
 * Save keeps using the existing payload builder + PATCH contract.
 */
export function StaffProfileCard({ staff }: { staff: StaffDetail }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <SectionCard
        id="staff-profile"
        title="Profile"
        description="Update this staff member's identity, contact and location details."
        action={
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        }
      >
        <StaffForm
          initial={staff}
          onSubmit={async (values) => {
            try {
              await staffApi.update(staff.id, values);
              toast.success("Staff saved");
              qc.invalidateQueries();
              setEditing(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Save failed");
            }
          }}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      id="staff-profile"
      title="Profile"
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          aria-label="Edit staff profile"
        >
          <Pencil className="h-4 w-4" aria-hidden /> Edit
        </Button>
      }
    >
      <div className="space-y-5">
        <ProfileGroup label="Identity">
          <PropertyList
            items={[
              ...(staff.useDisplayName
                ? [{ label: "Display name", value: staff.displayName }]
                : []),
              { label: "Legal name", value: staff.legalName },
              { label: "Role", value: staff.role },
              { label: "Employment", value: staff.status === "active" ? "Active" : "Inactive" },
            ]}
          />
        </ProfileGroup>

        <ProfileGroup label="Contact">
          <PropertyList
            items={[
              { label: "Email", value: staff.email },
              { label: "Phone", value: staff.phone },
            ]}
          />
        </ProfileGroup>

        <ProfileGroup label="Location">
          <PropertyList
            items={[
              { label: "Home address", value: staff.address },
              { label: "City", value: staff.city },
            ]}
          />
        </ProfileGroup>

        <ProfileGroup label="Additional">
          <PropertyList
            columns={1}
            items={[
              {
                label: "Notes",
                value: staff.notes ? (
                  <span className="whitespace-pre-wrap">{staff.notes}</span>
                ) : (
                  ""
                ),
              },
            ]}
          />
        </ProfileGroup>
      </div>
    </SectionCard>
  );
}

function ProfileGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      {children}
    </section>
  );
}
