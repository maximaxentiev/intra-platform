import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import { CarerDocumentsBackLink, CarerDocumentsForm } from "@/components/carer/CarerDocumentsForm";
import { carerDocumentsApi } from "@/lib/carer-documents";
import { assertOnboardingStepAccess } from "@/lib/carer-route-guards";
import { stepPathForNumber } from "@/lib/carer-onboarding";

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

  const documents = useQuery({
    queryKey: ["carer-documents"],
    queryFn: () => carerDocumentsApi.get(),
  });

  return (
    <CarerShell
      session={carer}
      title="Documents"
      subtitle="Upload the documents Intra needs to review before you can be considered fully compliant for shifts."
    >
      <CarerOnboardingShell
        activeStep={2}
        profileCompletedAt={carer.profileCompletedAt}
        onboardingStep={carer.onboardingStep}
        onboardingCompletedAt={carer.onboardingCompletedAt}
      >
        <CarerDocumentsBackLink />
        <CarerDocumentsForm
          mode="onboarding"
          documents={documents.data}
          isLoading={documents.isLoading}
          step2Complete={Boolean(documents.data?.documentsCompletedAt)}
          onRefresh={() => documents.refetch()}
          onStepComplete={() => navigate({ to: stepPathForNumber(3), replace: true })}
        />
      </CarerOnboardingShell>
    </CarerShell>
  );
}
