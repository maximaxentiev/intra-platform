// Carer (independent-carer) portal client. Deliberately separate from the ops
// `authApi` in db.ts: the API keeps two independent session cookies and the two
// account systems must never be confused for one another.
import { api } from "@/lib/api";

export type CarerAccountStatus = "invited" | "incomplete" | "active" | "disabled";

export interface CarerSession {
  accountId: string;
  staffId: string;
  email: string;
  status: CarerAccountStatus;
  onboardingStep: number;
  onboardingCompletedAt: string | null;
  legalFirstName: string;
  legalLastName: string;
  phone: string;
  address: string;
  city: string;
}

export interface CarerInviteInfo {
  email: string;
  legalFirstName: string;
  legalLastName: string;
  alreadySetUp: boolean;
}

export const carerAuthApi = {
  session: () => api.get<CarerSession>("/staff-auth/session"),
  login: (email: string, password: string) =>
    api.post<CarerSession>("/staff-auth/login", { email, password }),
  invite: (token: string) => api.get<CarerInviteInfo>(`/staff-auth/invite/${token}`),
  acceptInvite: (token: string, password: string) =>
    api.post<CarerSession>("/staff-auth/accept-invite", { token, password }),
  forgotPassword: (email: string) =>
    api.post<{ ok: true }>("/staff-auth/forgot-password", { email }),
  logout: () => api.post<{ ok: true }>("/staff-auth/logout"),
};

export function carerFullName(session: {
  legalFirstName: string;
  legalLastName: string;
}): string {
  return [session.legalFirstName, session.legalLastName].filter(Boolean).join(" ");
}

export function onboardingComplete(session: CarerSession): boolean {
  return Boolean(session.onboardingCompletedAt);
}

/** Where a signed-in carer belongs right now. */
export function carerLandingPath(session: CarerSession): "/carer" | "/carer/onboarding" {
  return onboardingComplete(session) ? "/carer" : "/carer/onboarding";
}

/** Client-side mirror of the API's password policy, for instant feedback. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (!/[a-z]/.test(password)) return "Include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Include a number.";
  return null;
}
