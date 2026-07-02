import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, CalendarClock, Users, Building2, CalendarDays, UserCircle2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/shifts", label: "Shifts", icon: CalendarClock },
  { to: "/staff", label: "Staff", icon: Users },
  { to: "/centres", label: "Centres", icon: Building2 },
  { to: "/availability", label: "Availability", icon: CalendarDays },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = useRouterState({ select: s => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="hidden md:flex w-60 flex-col border-r bg-card">
        <div className="p-5 border-b">
          <div className="text-base font-semibold">Ops Portal</div>
          <div className="text-xs text-muted-foreground">Childcare Staffing</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-1">
          <Link to="/profile" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted">
            <UserCircle2 className="h-4 w-4" /> My profile
          </Link>
          <Button variant="ghost" onClick={signOut} className="w-full justify-start">
            <LogOut className="h-4 w-4 mr-3" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 border-b bg-card px-4 py-3 flex items-center gap-2 overflow-x-auto">
        <div className="font-semibold shrink-0 mr-2">Ops</div>
        {NAV.map(({ to, label }) => {
          const active = path === to || path.startsWith(to + "/");
          return (
            <Link key={to} to={to} className={`text-xs px-3 py-1.5 rounded-md shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {label}
            </Link>
          );
        })}
        <Link to="/profile" className="text-xs px-3 py-1.5 rounded-md bg-muted shrink-0">Me</Link>
      </div>

      <main className="flex-1 min-w-0 md:pt-0 pt-14">
        <div className="p-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
