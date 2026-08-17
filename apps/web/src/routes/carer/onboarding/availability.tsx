import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import {
  CarerAvailabilityOnboardingWizard,
  CarerAvailabilityOnboardingWizardSkeleton,
} from "@/components/carer/CarerAvailabilityOnboardingWizard";
import { Button } from "@/components/ui/button";
import { carerAuthApi } from "@/lib/carer";
import { assertOnboardingStepAccess } from "@/lib/carer-route-guards";
import { CARER_ONBOARDING_HUB_PATH } from "@/lib/carer-onboarding-hub";
import {
  CARER_AVAILABILITY_ONBOARDING_STATE_QUERY_KEY,
  carerAvailabilityApi,
  mapAvailabilityApiError,
} from "@/lib/carer-availability";
import { CarerAvailabilityLoadError } from "@/components/carer/CarerAvailabilityShared";

export const Route = createFileRoute("/carer/onboarding/availability")({
  ssr: false,
  beforeLoad: ({ context }) => {
    assertOnboardingStepAccess(context.carer, "/carer/onboarding/availability");
  },
  component: CarerOnboardingAvailabilityPage,
});

function CarerOnboardingAvailabilityPage() {
  const { carer } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();

  const onboardingState = useQuery({
    queryKey: CARER_AVAILABILITY_ONBOARDING_STATE_QUERY_KEY,
    queryFn: async () => {
      await carerAvailabilityApi.ensureOnboardingState();
      return carerAvailabilityApi.getOnboardingState();
    },
    retry: 1,
  });

  const state = onboardingState.data;
  const initFailed = onboardingState.isError;
  const initError = initFailed
    ? mapAvailabilityApiError(onboardingState.error, "Could not load your onboarding availability.")
    : null;

  async function handleAvailabilityStepComplete() {
    await carerAuthApi.session();
    await router.invalidate();
    navigate({ to: CARER_ONBOARDING_HUB_PATH, replace: true });
  }

  return (
    <CarerShell
      session={carer}
      title="Availability"
      subtitle="Add the days and times you're available to work."
    >
      <CarerOnboardingShell activeStep={3} session={carer}>
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

        {onboardingState.isLoading || !state?.anchorEstablished ? (
          initFailed ? (
            <CarerAvailabilityLoadError onRetry={() => void onboardingState.refetch()} />
          ) : (
            <CarerAvailabilityOnboardingWizardSkeleton />
          )
        ) : initFailed ? (
          <div className="space-y-2">
            {initError ? (
              <p className="text-sm text-destructive" role="alert">
                {initError}
              </p>
            ) : null}
            <CarerAvailabilityLoadError onRetry={() => void onboardingState.refetch()} />
          </div>
        ) : (
          <CarerAvailabilityOnboardingWizard
            onboardingState={state}
            isFetching={onboardingState.isFetching}
            loadFailed={false}
            onRefresh={() => onboardingState.refetch()}
            onComplete={() => void handleAvailabilityStepComplete()}
          />
        )}
      </CarerOnboardingShell>
    </CarerShell>
  );
}
