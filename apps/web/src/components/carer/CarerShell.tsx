import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { carerAuthApi, carerFullName, type CarerSession } from "@/lib/carer";
import { Button } from "@/components/ui/button";

/** Minimal chrome for the carer-facing portal — deliberately separate from AppShell. */
export function CarerShell({
  session,
  title,
  subtitle,
  children,
}: {
  session: CarerSession;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();

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
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <Link to="/carer" className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              IN
            </div>
            <span className="truncate text-sm font-semibold">
              {carerFullName(session) || session.email}
            </span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 shrink-0 gap-1.5"
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
