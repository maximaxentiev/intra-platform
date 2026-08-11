import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer invite unavailable UX", () => {
  it("shows generic unavailable message without auto redirect", () => {
    const invite = readSrc("routes/carer/invite.$token.tsx");
    expect(invite).toContain("CarerInviteUnavailable");
    expect(invite).not.toMatch(/navigate\s*\(\s*\{\s*to:\s*["']\/carer\/login/);
    expect(invite).not.toMatch(/redirect\s*\(\s*\{\s*to:\s*["']\/carer\/login/);
  });

  it("does not distinguish expired vs used in the UI copy", () => {
    const unavailable = readSrc("components/carer/CarerInviteUnavailable.tsx");
    expect(unavailable).toContain("This invitation link is no longer available");
    expect(unavailable).not.toMatch(/expired|already been used|invalid token/i);
    expect(unavailable).not.toContain("$token");
  });

  it("includes Go to Carer Login button targeting /carer/login", () => {
    const unavailable = readSrc("components/carer/CarerInviteUnavailable.tsx");
    expect(unavailable).toContain("Go to Carer Login");
    expect(unavailable).toContain('to="/carer/login"');
  });

  it("keeps feature-flag-off unavailable screen on parent route", () => {
    const route = readSrc("routes/carer/route.tsx");
    expect(route).toContain("CarerPortalUnavailable");
  });
});

describe("carer onboarding revisit navigation", () => {
  it("documents page links back to personal information", () => {
    const docs = readSrc("routes/carer/onboarding/documents.tsx");
    expect(docs).toContain("/carer/onboarding/profile");
    expect(docs).toMatch(/Personal Information/);
  });

  it("profile form skips re-completing step 1 when already complete", () => {
    const form = readSrc("components/carer/CarerPersonalInformationForm.tsx");
    expect(form).toContain("step1Complete");
    expect(form).toMatch(/if \(step1Complete\)/);
    expect(form).toContain("completeStep1");
  });

  it("progress shell uses persisted completion state", () => {
    const shell = readSrc("components/carer/CarerOnboardingShell.tsx");
    expect(shell).toContain("profileCompletedAt");
    expect(shell).toContain("resolveOnboardingStepDisplayState");
    expect(shell).not.toContain("currentStep");
  });
});
