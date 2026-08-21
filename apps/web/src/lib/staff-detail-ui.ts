import type { PortalAccountInfo } from "@/lib/db";

/**
 * Presentation helpers for the Staff detail operational summary.
 *
 * Every value here is derived from authoritative server fields only.
 * No new readiness or compliance rules are invented on the frontend.
 */

export type OnboardingSummary = {
  label: string;
  tone: "success" | "info" | "neutral";
};

/** Summarises onboarding using only server-provided portal-account fields. */
export function onboardingSummary(portal: PortalAccountInfo | null): OnboardingSummary {
  if (!portal) return { label: "Not started", tone: "neutral" };
  if (portal.onboardingCompletedAt) return { label: "Complete", tone: "success" };
  if (portal.profileCompletedAt) {
    return { label: `Step ${portal.onboardingStep ?? 2} of 3`, tone: "info" };
  }
  if (portal.onboardingStep && portal.onboardingStep > 1) {
    return { label: `Step ${portal.onboardingStep} of 3`, tone: "info" };
  }
  return { label: "Not started", tone: "neutral" };
}

/** Which portal metadata rows are worth showing for the current state. */
export function portalMetaVisibility(portal: PortalAccountInfo | null) {
  const status = portal?.accountStatus ?? "no_account";
  return {
    email: Boolean(portal?.email),
    inviteSentAt: Boolean(portal?.inviteSentAt),
    inviteExpiresAt: Boolean(portal?.inviteExpiresAt) && status === "invited",
    lastLoginAt: Boolean(portal?.lastLoginAt),
    onboarding: status !== "no_account",
  };
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}
