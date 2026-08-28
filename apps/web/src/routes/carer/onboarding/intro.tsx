import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  CarerOnboardingStepShell,
  ONBOARDING_INTRO_COPY,
} from "@/components/carer/CarerOnboardingStepShell";
import { Button } from "@/components/ui/button";
import { carerAuthApi } from "@/lib/carer";
import { carerOnboardingApi } from "@/lib/carer-onboarding-api";
import { assertOnboardingIntroAccess } from "@/lib/carer-route-guards";

export const Route = createFileRoute("/carer/onboarding/intro")({
  ssr: false,
  beforeLoad: ({ context }) => {
    assertOnboardingIntroAccess(context.carer);
  },
  component: CarerOnboardingIntroPage,
});

function CarerOnboardingIntroPage() {
  const { carer } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      await carerOnboardingApi.start();
      await carerAuthApi.session();
      await router.invalidate();
      navigate({ to: "/carer/onboarding/profile", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start onboarding");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CarerOnboardingStepShell session={carer} title="Welcome to Intra" instructions={ONBOARDING_INTRO_COPY}>
      <div className="flex justify-center pt-2">
        <Button
          type="button"
          className="h-12 min-w-[14rem] px-8 text-base font-semibold"
          disabled={loading}
          onClick={() => void handleStart()}
        >
          {loading ? "Starting…" : "Start onboarding now"}
        </Button>
      </div>
    </CarerOnboardingStepShell>
  );
}
