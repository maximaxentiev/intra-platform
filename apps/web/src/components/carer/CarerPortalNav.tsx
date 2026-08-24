import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarClock, CalendarDays, FileText, Home, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CARER_NAV_ITEMS, activeCarerNavKey, type CarerNavKey } from "@/lib/carer-portal-nav";

const NAV_ICONS: Record<CarerNavKey, LucideIcon> = {
  home: Home,
  shifts: CalendarClock,
  availability: CalendarDays,
  documents: FileText,
  profile: User,
};

function useActiveNavKey(): CarerNavKey | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return activeCarerNavKey(pathname);
}

/** Horizontal navigation shown alongside the header on tablet and up. */
export function CarerTopNav() {
  const active = useActiveNavKey();

  return (
    <nav aria-label="Carer portal" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {CARER_NAV_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const isActive = item.key === active;
          return (
            <li key={item.key}>
              <Link
                to={item.path}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Thumb-reachable bottom bar for phones. */
export function CarerBottomNav() {
  const active = useActiveNavKey();

  return (
    <nav
      aria-label="Carer portal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {CARER_NAV_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const isActive = item.key === active;
          return (
            <li key={item.key} className="min-w-0">
              <Link
                to={item.path}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    isActive ? "bg-primary/10" : "bg-transparent",
                  ].join(" ")}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="w-full truncate text-center">{item.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
