import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { carerAuthApi, type CarerSession } from "@/lib/carer";
import { IntraAuthLogo } from "@/components/auth/IntraAuthLogo";
import { Button } from "@/components/ui/button";

type CarerOnboardingStepShellProps = {
  session: CarerSession;
  title: string;
  instructions?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
};

/** Minimal onboarding chrome — no portal navigation or stepper. */
export function CarerOnboardingStepShell({
  session,
  title,
  instructions,
  children,
  actions,
}: CarerOnboardingStepShellProps) {
  const navigate = useNavigate();

  async function signOut() {
    try {
      await carerAuthApi.logout();
    } catch {
      /* ignore */
    }
    toast.success("Signed out");
    navigate({ to: "/carer/login", replace: true });
  }

  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <IntraAuthLogo size="nav" />
            <span className="text-sm font-semibold leading-tight">Intra</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-11 min-h-11 shrink-0 gap-1.5"
            onClick={() => void signOut()}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        <div className="mb-6 space-y-4">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {instructions ? (
            <div className="text-base leading-relaxed text-foreground sm:text-lg">{instructions}</div>
          ) : null}
        </div>

        <div className="min-w-0">{children}</div>

        {actions ? (
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {actions}
          </div>
        ) : null}
      </main>
    </div>
  );
}

export const ONBOARDING_STEP_1_TITLE = "Onboarding Step 1 - Confirm your personal information";

export const ONBOARDING_STEP_1_INSTRUCTIONS = (
  <>
    <p>
      Review your personal information to verify that everything is correct and accurate.
    </p>
    <p className="mt-3">Once you are done, click &quot;Continue to step 2&quot;.</p>
  </>
);

export const ONBOARDING_STEP_2_TITLE = "Onboarding Step 2 - Submit documents";

export const ONBOARDING_STEP_2_INSTRUCTIONS = (
  <>
    <p>
      Upload all of your documents. There are required and optional documents. However, we recommend
      that you upload as many of the requested documents as possible to get the most shift
      opportunities from Intra. For each document field, you may upload up to 10 documents. If you
      need some time to gather all of your documents, you can close this page and come back when you
      are ready.
    </p>
    <p className="mt-3">Once you have submitted all of your documents, click &quot;Continue to final step&quot;.</p>
  </>
);

export const ONBOARDING_STEP_3_TITLE = "Final step - Submit availability";

export const ONBOARDING_STEP_3_INSTRUCTIONS = (
  <>
    <p>
      Let us know what days and times you are available for the next two weeks to work shifts. For
      each day, you can add multiple availability windows.
    </p>
    <p className="mt-3">Once you have submitted two weeks of availability, click &quot;Complete onboarding&quot;.</p>
  </>
);

export const ONBOARDING_INTRO_COPY = (
  <>
    <p>
      You are about to begin the Intra platform onboarding. There are 3 steps and it only takes 5
      minutes.
    </p>
    <p className="mt-4">
      You must complete this onboarding to receive shifts. If you do not complete the onboarding,
      you will not receive shifts.
    </p>
    <p className="mt-4">
      If you are not ready to do the onboarding, you can leave and come back at any time by logging
      in at platform.intra.ca/carer or by clicking the button in our latest email we sent you.
    </p>
  </>
);
