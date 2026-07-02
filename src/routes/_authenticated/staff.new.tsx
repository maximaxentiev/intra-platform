import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { db } from "@/lib/db";
import { StaffForm } from "@/components/StaffForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/staff/new")({
  component: NewStaff,
});

function NewStaff() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Add staff</h1>
      <StaffForm
        initial={{}}
        onSubmit={async (values) => {
          const { data, error } = await db.from("staff").insert(values).select("id").single();
          if (error) { toast.error(error.message); return; }
          toast.success("Staff created");
          navigate({ to: "/staff/$id", params: { id: data.id } });
        }}
      />
    </div>
  );
}
