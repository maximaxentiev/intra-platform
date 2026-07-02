import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { db } from "@/lib/db";
import { CentreForm } from "@/components/CentreForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/centres/new")({
  component: NewCentre,
});

function NewCentre() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Add centre</h1>
      <CentreForm
        initial={{}}
        onSubmit={async (values) => {
          const { data, error } = await db.from("centres").insert(values).select("id").single();
          if (error) { toast.error(error.message); return; }
          toast.success("Centre created");
          navigate({ to: "/centres/$id", params: { id: data.id } });
        }}
      />
    </div>
  );
}
