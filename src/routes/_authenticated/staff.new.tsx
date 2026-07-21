import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { db } from "@/lib/db";
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
              const { data, error } = await db.from("staff").insert(values).select("id").single();
              if (error) { toast.error(error.message); return; }
              toast.success("Staff created");
              navigate({ to: "/staff/$id", params: { id: data.id } });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
