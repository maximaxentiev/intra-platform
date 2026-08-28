import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CarerOnboardingForwardButton } from "@/components/carer/CarerOnboardingForwardButton";
import {
  CarerOnboardingStepShell,
  ONBOARDING_STEP_3_INSTRUCTIONS,
  ONBOARDING_STEP_3_TITLE,
} from "@/components/carer/CarerOnboardingStepShell";
import {
  CarerAvailabilityOnboardingWizard,
  CarerAvailabilityOnboardingWizardSkeleton,
} from "@/components/carer/CarerAvailabilityOnboardingWizard";
import { CarerAvailabilityLoadError } from "@/components/carer/CarerAvailabilityShared";
import { carerAuthApi } from "@/lib/carer";
import { carerOnboardingApi } from "@/lib/carer-onboarding-api";
import type { CarerOnboardingCompletionLocationState } from "@/lib/carer-onboarding-completion";
import { mapOnboardingCompleteError } from "@/lib/carer-onboarding-hub";
import { assertOnboardingStepAccess } from "@/lib/carer-route-guards";
import {
  CARER_AVAILABILITY_ONBOARDING_STATE_QUERY_KEY,
  carerAvailabilityApi,
  mapAvailabilityApiError,
} from "@/lib/carer-availability";

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
  const [completing, setCompleting] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);

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
  const stepSaving = completing || availabilityBusy;

  async function handleCompleteOnboarding() {
    if (stepSaving) return;
    setCompleting(true);
    try {
      if (!carer.availabilityComplete) {
        await carerAvailabilityApi.completeOnboardingStep();
      }
      await carerOnboardingApi.complete();
      await carerAuthApi.session();
      await router.invalidate();
      const completionState: CarerOnboardingCompletionLocationState = {
        onboardingJustCompleted: true,
      };
      navigate({
        to: "/carer",
        replace: true,
        state: completionState as never,
      });
    } catch (err) {
      const message = mapOnboardingCompleteError(
        err,
        "Could not complete onboarding. Try again.",
      );
      toast.error(message);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <CarerOnboardingStepShell
      session={carer}
      title={ONBOARDING_STEP_3_TITLE}
      instructions={ONBOARDING_STEP_3_INSTRUCTIONS}
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-12 min-w-[10rem] px-6 text-base font-medium sm:order-1"
            disabled={stepSaving}
            onClick={() => navigate({ to: "/carer/onboarding/documents" })}
          >
            Go back
          </Button>
          <CarerOnboardingForwardButton
            label="Complete onboarding"
            saving={stepSaving}
            disabled={onboardingState.isLoading || !state?.anchorEstablished}
            onClick={() => void handleCompleteOnboarding()}
            className="sm:order-2"
          />
        </>
      }
    >
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
          onBusyChange={setAvailabilityBusy}
        />
      )}
    </CarerOnboardingStepShell>
  );
}
