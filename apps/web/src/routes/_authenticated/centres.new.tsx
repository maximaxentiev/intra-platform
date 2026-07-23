import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { centresApi, saveCentreSecondaryChannels } from "@/lib/db";
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
              try {
                const created = await centresApi.create(values);
                await saveCentreSecondaryChannels(created.id, secondary);
                toast.success("Centre created");
                navigate({ to: "/centres/$id", params: { id: created.id }, search: { tab: "staff-lists" } });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Create failed");
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
