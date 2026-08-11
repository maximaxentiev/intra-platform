import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import { CarerPersonalInformationForm } from "@/components/carer/CarerPersonalInformationForm";
import { carerProfileApi } from "@/lib/carer";
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
      <CarerOnboardingShell
        activeStep={1}
        profileCompletedAt={carer.profileCompletedAt}
        onboardingStep={carer.onboardingStep}
        onboardingCompletedAt={carer.onboardingCompletedAt}
      >
        <CarerPersonalInformationForm
          initial={initial}
          step1Complete={Boolean(carer.profileCompletedAt)}
          onStepComplete={() =>
            navigate({ to: "/carer/onboarding/documents", replace: true })
          }
        />
      </CarerOnboardingShell>
    </CarerShell>
  );
}
