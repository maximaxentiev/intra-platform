import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { staffApi } from "@/lib/db";
import { ManualStaffCreateForm } from "@/components/ManualStaffCreateForm";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/staff/new")({
  component: NewStaff,
});

function NewStaff() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl space-y-6 overflow-x-hidden">
      <PageHeader
        eyebrow="New"
        backTo="/staff"
        backLabel="Back to Staff"
        title="Add staff"
        subtitle="Create a staff profile. Send a portal invitation from their profile when you are ready."
      />
      <Card className="border-border/70 shadow-xs">
        <CardContent className="pt-6">
          <ManualStaffCreateForm
            onSubmit={async (values) => {
              try {
                const created = await staffApi.createManual({
                  ...values,
                  role: values.role as "ECA" | "ECE" | "Nanny",
                });
                toast.success("Staff member created");
                navigate({ to: "/staff/$id", params: { id: created.id } });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Create failed");
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
