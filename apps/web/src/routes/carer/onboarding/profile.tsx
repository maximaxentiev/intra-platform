import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CarerOnboardingHubShell } from "@/components/carer/CarerOnboardingHubShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import { CarerOnboardingHomeLink } from "@/components/carer/CarerOnboardingHomeLink";
import { CarerPersonalInformationForm } from "@/components/carer/CarerPersonalInformationForm";
import { carerAuthApi, carerProfileApi } from "@/lib/carer";
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
    navigate({ to: "/carer/onboarding/documents", replace: true });
  }

  if (profile.isLoading && !profile.data) {
    return (
      <CarerOnboardingHubShell session={carer} title="Personal information">
        <Skeleton className="h-40 w-full" />
      </CarerOnboardingHubShell>
    );
  }

  const initial = personalProfileFromSession(profile.data);

  return (
    <CarerOnboardingHubShell
      session={carer}
      title="Personal information"
      subtitle="Confirm your contact details so we can reach you about shifts."
    >
      <CarerOnboardingShell activeStep={1} session={carer}>
        <CarerOnboardingHomeLink />
        <CarerPersonalInformationForm
          initial={initial}
          step1Complete={carer.profileComplete}
          onStepComplete={() => void handleStepComplete()}
        />
      </CarerOnboardingShell>
    </CarerOnboardingHubShell>
  );
}
