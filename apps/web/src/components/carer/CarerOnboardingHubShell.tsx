import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { carerAuthApi, carerFullName, type CarerSession } from "@/lib/carer";
import { CARER_ONBOARDING_HUB_PATH } from "@/lib/carer-onboarding-hub";
import { Button } from "@/components/ui/button";

/** Distinct onboarding chrome — separate from the regular Carer portal shell. */
export function CarerOnboardingHubShell({
  session,
  title = "Onboarding",
  subtitle,
  children,
}: {
  session: CarerSession;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
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
        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
          <Link to={CARER_ONBOARDING_HUB_PATH} className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              IN
            </div>
            <span className="min-w-0 truncate">
              <span className="block text-sm font-semibold leading-tight">Intra</span>
              <span className="block truncate text-xs text-muted-foreground">
                {carerFullName(session) || session.email}
              </span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-11 min-h-11 shrink-0 gap-1.5"
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-5">
        <div className="mb-5 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  );
}
