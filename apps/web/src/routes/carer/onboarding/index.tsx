import { createFileRoute, redirect } from "@tanstack/react-router";
import { carerOnboardingResumePath } from "@/lib/carer-onboarding";

export const Route = createFileRoute("/carer/onboarding/")({
  ssr: false,
  beforeLoad: ({ context }) => {
    throw redirect({ to: carerOnboardingResumePath(context.carer), replace: true });
  },
});
