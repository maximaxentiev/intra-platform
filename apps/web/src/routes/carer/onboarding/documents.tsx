import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import { CarerDocumentsForm } from "@/components/carer/CarerDocumentsForm";
import { Button } from "@/components/ui/button";
import { carerAuthApi } from "@/lib/carer";
import { carerDocumentsApi } from "@/lib/carer-documents";
import { CARER_ONBOARDING_HUB_PATH } from "@/lib/carer-onboarding-hub";
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
    navigate({ to: CARER_ONBOARDING_HUB_PATH, replace: true });
  }

  return (
    <CarerShell
      session={carer}
      title="Documents"
      subtitle="Upload the documents Intra needs to review before you can be considered fully compliant for shifts."
    >
      <CarerOnboardingShell activeStep={2} session={carer}>
        <Button
          asChild
          variant="ghost"
          className="mb-4 h-10 px-0 text-muted-foreground hover:text-foreground"
        >
          <Link to={CARER_ONBOARDING_HUB_PATH}>
            <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Back to onboarding
          </Link>
        </Button>
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
