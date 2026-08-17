import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import { CarerOnboardingHomeLink } from "@/components/carer/CarerOnboardingHomeLink";
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
    <CarerShell
      session={carer}
      title="Documents"
      subtitle="Upload the documents Intra needs to review before you can be considered fully compliant for shifts."
    >
      <CarerOnboardingShell activeStep={2} session={carer}>
        <CarerOnboardingHomeLink />
        <CarerDocumentsForm
          mode="onboarding"
          documents={documents.data}
          isLoading={documents.isLoading}
          step2Complete={carer.documentsComplete}
          onRefresh={() => documents.refetch()}
          onStepComplete={() => void handleStepComplete()}
        />
      </CarerOnboardingShell>
    </CarerShell>
  );
}
