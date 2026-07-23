import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { staffApi } from "@/lib/db";
import { StaffForm } from "@/components/StaffForm";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/staff/new")({
  component: NewStaff,
});

function NewStaff() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow="New"
        backTo="/staff"
        backLabel="Back to Staff"
        title="Add staff"
        subtitle="Create a new staff profile. You can set availability and preferences afterwards."
      />
      <Card className="border-border/70 shadow-xs">
        <CardContent className="pt-6">
          <StaffForm
            initial={{}}
            onSubmit={async (values) => {
              try {
                const created = await staffApi.create(values);
                toast.success("Staff created");
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
