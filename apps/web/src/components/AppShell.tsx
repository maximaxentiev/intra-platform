import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarClock,
  Users,
  Building2,
  CalendarDays,
  UserCircle2,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/shifts", label: "Shifts", icon: CalendarClock },
  { to: "/staff", label: "Staff", icon: Users },
  { to: "/centres", label: "Centres", icon: Building2 },
  { to: "/availability", label: "Availability", icon: CalendarDays },
] as const;

function useCurrentPath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: any;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-80 group-hover:opacity-100")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const path = useCurrentPath();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    authApi
      .me()
      .then((u) => setEmail(u.email ?? ""))
      .catch(() => setEmail(""));
  }, []);

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  async function signOut() {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear();
      router.navigate({ to: "/auth", replace: true });
    }
  }

  const isActive = (to: string) => path === to || path.startsWith(to + "/");

  const Brand = (
    <Link to="/dashboard" className="flex items-center gap-2.5 px-1">
      <div
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm"
      >
        OP
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-none text-foreground">Ops Portal</div>
        <div className="mt-1 text-[11px] text-muted-foreground">Childcare Staffing</div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex fixed inset-y-0 left-0 z-30 w-60 flex-col border-r border-sidebar-border bg-sidebar"
        aria-label="Primary"
      >
        <div className="px-4 py-5 border-b border-sidebar-border">{Brand}</div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} active={isActive(item.to)} />
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <Link
            to="/profile"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive("/profile")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <UserCircle2 className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium leading-tight">My profile</div>
              {email && <div className="truncate text-[11px] text-muted-foreground">{email}</div>}
            </div>
          </Link>
          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-start h-9 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-3" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between px-4 h-14">
          {Brand}
          <Button
            variant="ghost"
            size="icon"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
            className="h-10 w-10"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        {mobileOpen && (
          <nav className="border-t border-border p-3 space-y-1 bg-sidebar">
            {NAV.map((item) => (
              <NavItem key={item.to} {...item} active={isActive(item.to)} onNavigate={() => setMobileOpen(false)} />
            ))}
            <div className="my-2 border-t border-sidebar-border" />
            <NavItem
              to="/profile"
              label="My profile"
              icon={UserCircle2}
              active={isActive("/profile")}
              onNavigate={() => setMobileOpen(false)}
            />
            <Button
              variant="ghost"
              onClick={signOut}
              className="w-full justify-start h-10 text-sm text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-3" /> Sign out
            </Button>
          </nav>
        )}
      </div>

      {/* Main content */}
      <main className="md:pl-60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
