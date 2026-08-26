import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { carerAuthApi, carerFullName, type CarerSession } from "@/lib/carer";
import { CarerBottomNav, CarerTopNav } from "@/components/carer/CarerPortalNav";
import { Button } from "@/components/ui/button";

/** Minimal chrome for the carer-facing portal — deliberately separate from AppShell. */
export function CarerShell({
  session,
  title,
  subtitle,
  actions,
  children,
}: {
  session: CarerSession;
  title: string;
  subtitle?: string;
  /** Optional page-level action rendered beside the title on wider screens. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const carerName = carerFullName(session) || session.email;

  async function signOut() {
    try {
      await carerAuthApi.logout();
    } catch {
      /* ignore — clear the UI regardless */
    }
    toast.success("Signed out");
    navigate({ to: "/carer/login", replace: true });
  }

  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 md:max-w-5xl">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/carer" className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                IN
              </div>
              <span className="truncate text-sm font-semibold leading-tight">Intra</span>
            </Link>
            <CarerTopNav />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground lg:inline">
              {carerName}
            </span>
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
        </div>
      </header>

      <main
        className="mx-auto max-w-3xl px-4 pt-5 pb-28 md:max-w-5xl md:pb-12"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        {children}
      </main>

      <CarerBottomNav />
    </div>
  );
}
