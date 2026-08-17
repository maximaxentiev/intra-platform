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
  profileCompletedAt: string | null;
  documentsCompletedAt: string | null;
  availabilityCompletedAt: string | null;
  onboardingCompletedAt: string | null;
  profileComplete: boolean;
  documentsComplete: boolean;
  availabilityComplete: boolean;
  onboardingComplete: boolean;
  canCompleteOnboarding: boolean;
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

export type CarerPersonalProfile = {
  legalFirstName: string;
  legalLastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  profileCompletedAt: string | null;
  onboardingStep: number;
  onboardingCompletedAt: string | null;
};

export const carerProfileApi = {
  get: () => api.get<CarerPersonalProfile>("/staff-portal/profile"),
  save: (body: Omit<CarerPersonalProfile, "profileCompletedAt" | "onboardingStep" | "onboardingCompletedAt">) =>
    api.patch<CarerPersonalProfile>("/staff-portal/profile", body),
  completeStep1: () => api.post<CarerPersonalProfile>("/staff-portal/profile/complete-step-1"),
};

export function carerFullName(session: {
  legalFirstName: string;
  legalLastName: string;
}): string {
  return [session.legalFirstName, session.legalLastName].filter(Boolean).join(" ");
}

export { carerLandingPath, onboardingComplete } from "./carer-onboarding";

/** Client-side mirror of the API's password policy, for instant feedback. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (!/[a-z]/.test(password)) return "Include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Include a number.";
  return null;
}
