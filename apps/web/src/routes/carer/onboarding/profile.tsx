import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CarerOnboardingStepShell,
  ONBOARDING_STEP_1_INSTRUCTIONS,
  ONBOARDING_STEP_1_TITLE,
} from "@/components/carer/CarerOnboardingStepShell";
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
      <CarerOnboardingStepShell session={carer} title={ONBOARDING_STEP_1_TITLE}>
        <Skeleton className="h-40 w-full" />
      </CarerOnboardingStepShell>
    );
  }

  const initial = personalProfileFromSession(profile.data);

  return (
    <CarerOnboardingStepShell
      session={carer}
      title={ONBOARDING_STEP_1_TITLE}
      instructions={ONBOARDING_STEP_1_INSTRUCTIONS}
    >
      <CarerPersonalInformationForm
        initial={initial}
        step1Complete={carer.profileComplete}
        onStepComplete={() => void handleStepComplete()}
      />
    </CarerOnboardingStepShell>
  );
}
