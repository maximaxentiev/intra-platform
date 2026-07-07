import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { db, saveCentreSecondaryChannels } from "@/lib/db";
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
        onSubmit={async (values, secondary) => {
          const payload = { ...values, preferred_channel: values.primary_channel };
          const { data, error } = await db.from("centres").insert(payload).select("id").single();
          if (error) { toast.error(error.message); return; }
          try {
            await saveCentreSecondaryChannels(data.id, secondary);
          } catch (e: any) {
            toast.error(e.message);
            return;
          }
          toast.success("Centre created");
          navigate({ to: "/centres/$id", params: { id: data.id }, search: { tab: "staff-lists" } });
        }}
      />
    </div>
  );
}
