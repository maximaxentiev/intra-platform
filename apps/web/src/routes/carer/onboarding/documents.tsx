import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  CarerOnboardingStepShell,
  ONBOARDING_STEP_2_INSTRUCTIONS,
  ONBOARDING_STEP_2_TITLE,
} from "@/components/carer/CarerOnboardingStepShell";
import { CarerDocumentsForm } from "@/components/carer/CarerDocumentsForm";
import { carerAuthApi } from "@/lib/carer";
import { carerDocumentsApi } from "@/lib/carer-documents";
import { assertOnboardingStepAccess } from "@/lib/carer-route-guards";

export const Route = createFileRoute("/carer/onboarding/documents")({
  ssr: false,
  beforeLoad: ({ context }) => {
    assertOnboardingStepAccess(context.carer, "/carer/onboarding/documents");
  },
  component: CarerOnboardingDocumentsPage,
});

function CarerOnboardingDocumentsPage() {
  const { carer } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();

  const documents = useQuery({
    queryKey: ["carer-documents"],
    queryFn: () => carerDocumentsApi.get(),
  });

  async function handleStepComplete() {
    await carerAuthApi.session();
    await router.invalidate();
    navigate({ to: "/carer/onboarding/availability", replace: true });
  }

  return (
    <CarerOnboardingStepShell
      session={carer}
      title={ONBOARDING_STEP_2_TITLE}
      instructions={ONBOARDING_STEP_2_INSTRUCTIONS}
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-12 min-w-[10rem] px-6 text-base font-medium sm:order-1"
            onClick={() => navigate({ to: "/carer/onboarding/profile" })}
          >
            Go back
          </Button>
          <Button
            type="submit"
            form="carer-onboarding-documents-form"
            className="h-12 min-w-[12rem] px-6 text-base font-semibold sm:order-2"
          >
            Continue to final step
          </Button>
        </>
      }
    >
      <CarerDocumentsForm
        mode="onboarding"
        documents={documents.data}
        isLoading={documents.isLoading}
        step2Complete={carer.documentsComplete}
        onRefresh={() => documents.refetch()}
        onStepComplete={() => void handleStepComplete()}
      />
    </CarerOnboardingStepShell>
  );
}
