import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { db, saveCentreSecondaryChannels } from "@/lib/db";
import { CentreForm } from "@/components/CentreForm";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/centres/new")({
  component: NewCentre,
});

function NewCentre() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow="New"
        backTo="/centres"
        backLabel="Back to Centres"
        title="Add centre"
        subtitle="Create a new childcare centre. You'll add contacts and staff lists on the next screen."
      />
      <Card className="border-border/70 shadow-xs">
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>
    </div>
  );
}
