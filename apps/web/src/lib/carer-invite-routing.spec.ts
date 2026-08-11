import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { CarerSession } from "./carer";
import { CARER_LOGIN_PATH, resolveUnusableInviteRedirect } from "./carer-invite-routing";
import { carerLandingPath, carerOnboardingResumePath } from "./carer-onboarding";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

const baseSession: CarerSession = {
  accountId: "a",
  staffId: "s",
  email: "c@example.test",
  status: "incomplete",
  onboardingStep: 1,
  profileCompletedAt: null,
  onboardingCompletedAt: null,
  legalFirstName: "A",
  legalLastName: "B",
  phone: "1",
  address: "1",
  city: "C",
};

describe("resolveUnusableInviteRedirect", () => {
  it("redirects to carer login when no staff session", async () => {
    await expect(
      resolveUnusableInviteRedirect({
        getSession: vi.fn().mockRejectedValue(new Error("401")),
      }),
    ).resolves.toBe(CARER_LOGIN_PATH);
  });

  it("redirects incomplete onboarding to profile step", async () => {
    await expect(
      resolveUnusableInviteRedirect({
        getSession: vi.fn().mockResolvedValue(baseSession),
      }),
    ).resolves.toBe("/carer/onboarding/profile");
  });

  it("redirects after step 1 to documents resume", async () => {
    const session = {
      ...baseSession,
      profileCompletedAt: "2026-01-01T00:00:00.000Z",
      onboardingStep: 2,
    };
    await expect(
      resolveUnusableInviteRedirect({
        getSession: vi.fn().mockResolvedValue(session),
      }),
    ).resolves.toBe("/carer/onboarding/documents");
  });

  it("redirects fully onboarded carers to portal home", async () => {
    const session = {
      ...baseSession,
      onboardingCompletedAt: "2026-01-02T00:00:00.000Z",
    };
    await expect(
      resolveUnusableInviteRedirect({
        getSession: vi.fn().mockResolvedValue(session),
      }),
    ).resolves.toBe("/carer");
  });

  it("uses custom landingPath when provided", async () => {
    await expect(
      resolveUnusableInviteRedirect({
        getSession: vi.fn().mockResolvedValue(baseSession),
        landingPath: () => "/custom",
      }),
    ).resolves.toBe("/custom");
  });
});

describe("carerLandingPath integration", () => {
  it("matches onboarding resume for step 1 incomplete", () => {
    expect(carerLandingPath(baseSession)).toBe(carerOnboardingResumePath(baseSession));
  });
});

describe("invite route smart redirect policy", () => {
  it("validates invite in beforeLoad before any session redirect", () => {
    const invite = readSrc("routes/carer/invite.$token.tsx");
    expect(invite).toContain("beforeLoad");
    expect(invite).toContain("carerAuthApi.invite");
    expect(invite).toContain("resolveUnusableInviteRedirect");
    expect(invite).toMatch(/return \{ invite/);
  });

  it("only checks carer session when invite validation fails", () => {
    const invite = readSrc("routes/carer/invite.$token.tsx");
    expect(invite).toMatch(/try\s*\{[\s\S]*carerAuthApi\.invite[\s\S]*return \{ invite \}/);
    expect(invite).toMatch(/catch\s*\{[\s\S]*resolveUnusableInviteRedirect/);
  });

  it("redirects unusable invites automatically to carer login or landing", () => {
    const invite = readSrc("routes/carer/invite.$token.tsx");
    expect(invite).toContain('redirect({ to: destination, replace: true })');
    expect(invite).not.toContain("CarerInviteUnavailable");
  });

  it("never references ops auth or dashboard", () => {
    const invite = readSrc("routes/carer/invite.$token.tsx");
    expect(invite).not.toContain("authApi");
    expect(invite).not.toMatch(/to:\s*["']\/auth["']/);
    expect(invite).not.toMatch(/to:\s*["']\/dashboard["']/);
  });

  it("loading state does not expose token value", () => {
    const invite = readSrc("routes/carer/invite.$token.tsx");
    const pending = invite.slice(
      invite.indexOf("function InviteAccessPending"),
      invite.indexOf("function CarerInvitePage"),
    );
    expect(pending).toContain("Checking your Carer Portal access");
    expect(pending).not.toContain("token");
  });
});

describe("unusable invite scenarios", () => {
  it("uses staff-auth session API only for redirect resolution", () => {
    const routing = readSrc("lib/carer-invite-routing.ts");
    expect(routing).not.toContain("authApi");
    const invite = readSrc("routes/carer/invite.$token.tsx");
    expect(invite).toContain("carerAuthApi.session");
  });
});

describe("carer login session redirect", () => {
  it("redirects existing carer sessions via carerLandingPath", () => {
    const login = readSrc("routes/carer/login.tsx");
    expect(login).toContain("carerAuthApi.session");
    expect(login).toContain("carerLandingPath");
    expect(login).not.toContain("authApi");
    expect(login).not.toMatch(/to:\s*["']\/auth["']/);
    expect(login).not.toMatch(/to:\s*["']\/dashboard["']/);
  });

  it("shows login form when no carer session", () => {
    const login = readSrc("routes/carer/login.tsx");
    expect(login).toContain("Sign in");
    expect(login).toMatch(/catch[\s\S]*show the form/i);
  });
});

describe("feature flag off", () => {
  it("parent carer route still uses CarerPortalUnavailable", () => {
    const route = readSrc("routes/carer/route.tsx");
    expect(route).toContain("CarerPortalUnavailable");
    expect(route).not.toContain("resolveUnusableInviteRedirect");
  });
});
