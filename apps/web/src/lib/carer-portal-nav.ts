/**
 * Navigation model for the completed Carer Portal.
 * Pure data + matching helpers so the shell stays presentational and testable.
 */
export type CarerNavKey = "home" | "shifts" | "availability" | "documents" | "profile";

export type CarerNavItem = {
  key: CarerNavKey;
  /** Short label used by the mobile bottom bar. */
  shortLabel: string;
  /** Full label used by the desktop top navigation. */
  label: string;
  path: "/carer" | "/carer/shifts" | "/carer/availability" | "/carer/documents" | "/carer/profile";
};

export const CARER_NAV_ITEMS: readonly CarerNavItem[] = [
  { key: "home", shortLabel: "Home", label: "Home", path: "/carer" },
  { key: "shifts", shortLabel: "Shifts", label: "Shifts", path: "/carer/shifts" },
  {
    key: "availability",
    shortLabel: "Availability",
    label: "Availability",
    path: "/carer/availability",
  },
  { key: "documents", shortLabel: "Documents", label: "Documents", path: "/carer/documents" },
  { key: "profile", shortLabel: "Profile", label: "Profile", path: "/carer/profile" },
] as const;

/** Which nav item should read as current for a given pathname. */
export function activeCarerNavKey(pathname: string): CarerNavKey | null {
  const clean = pathname.replace(/\/+$/, "") || "/carer";
  if (clean === "/carer") return "home";
  if (clean.startsWith("/carer/shifts")) return "shifts";
  if (clean.startsWith("/carer/availability")) return "availability";
  if (clean.startsWith("/carer/documents")) return "documents";
  if (clean.startsWith("/carer/profile")) return "profile";
  return null;
}

/** Friendly greeting for the portal home, kept free of time-of-day guessing. */
export function carerGreeting(firstName: string): string {
  const name = firstName.trim();
  return name ? `Hi ${name}` : "Hi there";
}
