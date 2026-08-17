import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import { CarerPersonalInformationForm } from "@/components/carer/CarerPersonalInformationForm";
import { Button } from "@/components/ui/button";
import { carerAuthApi, carerProfileApi } from "@/lib/carer";
import { CARER_ONBOARDING_HUB_PATH } from "@/lib/carer-onboarding-hub";
import { personalProfileFromSession } from "@/lib/carer-personal-profile";
import { assertOnboardingStepAccess } from "@/lib/carer-route-guards";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/carer/onboarding/profile")({
  ssr: false,
  beforeLoad: ({ context }) => {
    assertOnboardingStepAccess(context.carer, "/carer/onboarding/profile");
  },
  component: CarerOnboardingProfilePage,
});

function CarerOnboardingProfilePage() {
  const { carer } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();

  const profile = useQuery({
    queryKey: ["carer-profile"],
    queryFn: () => carerProfileApi.get(),
    initialData: {
      ...personalProfileFromSession(carer),
      profileCompletedAt: carer.profileCompletedAt,
      onboardingStep: carer.onboardingStep,
      onboardingCompletedAt: carer.onboardingCompletedAt,
    },
  });

  async function handleStepComplete() {
    await carerAuthApi.session();
    await router.invalidate();
    navigate({ to: CARER_ONBOARDING_HUB_PATH, replace: true });
  }

  if (profile.isLoading && !profile.data) {
    return (
      <CarerShell session={carer} title="Personal information">
        <Skeleton className="h-40 w-full" />
      </CarerShell>
    );
  }

  const initial = personalProfileFromSession(profile.data);

  return (
    <CarerShell
      session={carer}
      title="Personal information"
      subtitle="Confirm your contact details so we can reach you about shifts."
    >
      <CarerOnboardingShell activeStep={1} session={carer}>
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
        <CarerPersonalInformationForm
          initial={initial}
          step1Complete={carer.profileComplete}
          onStepComplete={() => void handleStepComplete()}
        />
      </CarerOnboardingShell>
    </CarerShell>
  );
}
