import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CarerOnboardingHub } from "@/components/carer/CarerOnboardingHub";
import { CarerOnboardingHubShell } from "@/components/carer/CarerOnboardingHubShell";
import { carerAuthApi } from "@/lib/carer";
import { carerOnboardingApi } from "@/lib/carer-onboarding-api";
import type { CarerOnboardingCompletionLocationState } from "@/lib/carer-onboarding-completion";
import { mapOnboardingCompleteError } from "@/lib/carer-onboarding-hub";

export const Route = createFileRoute("/carer/onboarding/")({
  ssr: false,
  component: CarerOnboardingHubPage,
});

function CarerOnboardingHubPage() {
  const { carer: initialCarer } = Route.useRouteContext();
  const [session, setSession] = useState(initialCarer);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const router = useRouter();
  const navigate = useNavigate();

  async function refreshSession() {
    const fresh = await carerAuthApi.session();
    setSession(fresh);
    await router.invalidate();
    return fresh;
  }

  async function handleCompleteOnboarding() {
    setCompleteError(null);
    setCompleting(true);
    try {
      await carerOnboardingApi.complete();
      await refreshSession();
      const completionState: CarerOnboardingCompletionLocationState = {
        onboardingJustCompleted: true,
      };
      navigate({
        to: "/carer",
        replace: true,
        state: completionState as never,
      });
    } catch (err) {
      try {
        await refreshSession();
      } catch {
        toast.error("Could not refresh your session. Sign in again to continue.");
      }
      const message = mapOnboardingCompleteError(
        err,
        "Could not finish onboarding. Try again.",
      );
      setCompleteError(message);
      toast.error(message);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <CarerOnboardingHubShell session={session}>
      <CarerOnboardingHub
        session={session}
        completing={completing}
        completeError={completeError}
        onCompleteOnboarding={() => void handleCompleteOnboarding()}
      />
    </CarerOnboardingHubShell>
  );
}
