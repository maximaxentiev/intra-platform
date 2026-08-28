import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CARER_NAV_ITEMS, activeCarerNavKey, carerGreeting } from "./carer-portal-nav";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer portal navigation model", () => {
  it("exposes the five primary portal destinations", () => {
    expect(CARER_NAV_ITEMS.map((i) => i.key)).toEqual([
      "home",
      "shifts",
      "availability",
      "documents",
      "profile",
    ]);
  });

  it("resolves the active nav key from nested paths", () => {
    expect(activeCarerNavKey("/carer")).toBe("home");
    expect(activeCarerNavKey("/carer/")).toBe("home");
    expect(activeCarerNavKey("/carer/shifts/abc-123")).toBe("shifts");
    expect(activeCarerNavKey("/carer/availability")).toBe("availability");
    expect(activeCarerNavKey("/carer/documents")).toBe("documents");
    expect(activeCarerNavKey("/carer/profile")).toBe("profile");
  });

  it("does not mark onboarding or auth routes as portal nav destinations", () => {
    expect(activeCarerNavKey("/carer/onboarding")).toBeNull();
    expect(activeCarerNavKey("/carer/login")).toBeNull();
  });

  it("greets by first name and falls back gracefully", () => {
    expect(carerGreeting("Amara")).toBe("Hi Amara");
    expect(carerGreeting("  ")).toBe("Hi there");
  });
});

describe("carer portal shell", () => {
  it("renders both responsive navigations", () => {
    const shell = readSrc("components/carer/CarerShell.tsx");
    expect(shell).toContain("CarerTopNav");
    expect(shell).toContain("CarerBottomNav");
  });

  it("marks the current destination for assistive tech", () => {
    const nav = readSrc("components/carer/CarerPortalNav.tsx");
    expect(nav).toContain('aria-current={isActive ? "page" : undefined}');
    expect(nav).toContain('aria-label="Carer portal"');
    expect(nav).toContain("safe-area-inset-bottom");
  });

  it("uses legal full name in the shell header, not staff displayName", () => {
    const shell = readSrc("components/carer/CarerShell.tsx");
    expect(shell).toContain("carerFullName(session)");
    expect(shell).not.toContain("displayName");
    expect(shell).not.toContain("session.displayName");
  });

  it("keeps onboarding steps on onboarding chrome so portal nav cannot bounce off guards", () => {
    for (const rel of [
      "routes/carer/onboarding/profile.tsx",
      "routes/carer/onboarding/documents.tsx",
      "routes/carer/onboarding/availability.tsx",
    ]) {
      const src = readSrc(rel);
      expect(src).toContain("CarerOnboardingHubShell");
      expect(src).not.toContain("CarerBottomNav");
      expect(src).not.toMatch(/from "@\/components\/carer\/CarerShell"/);
    }
  });
});

describe("carer portal home", () => {
  it("leads with needs action, shifts, then availability", () => {
    const home = readSrc("routes/carer/index.tsx");
    expect(home).toContain("CarerNeedsActionSummary");
    expect(home).toContain("CarerShiftsDashboardSummary");
    expect(home).toContain("CarerAvailabilityDashboardSummary");
    expect(home.indexOf("<CarerNeedsActionSummary")).toBeLessThan(
      home.indexOf("<CarerShiftsDashboardSummary"),
    );
    expect(home.indexOf("<CarerShiftsDashboardSummary")).toBeLessThan(
      home.indexOf("<CarerAvailabilityDashboardSummary"),
    );
    expect(home).not.toContain("QuickLinkCard");
    expect(home).not.toContain("compliance documents");
  });

  it("uses a simple Home title without greeting copy", () => {
    const home = readSrc("routes/carer/index.tsx");
    expect(home).toContain('title="Home"');
    expect(home).not.toContain("carerGreeting");
    expect(home).not.toContain("Here's what's coming up.");
  });
});

describe("carer onboarding hub presentation", () => {
  it("shows ready-to-finish copy when all steps are complete but onboarding is not submitted", () => {
    const hub = readSrc("components/carer/CarerOnboardingHub.tsx");
    expect(hub).toContain("You're ready to finish setup");
    expect(hub).toContain("canFinish");
    expect(hub).toContain("Complete onboarding");
  });

  it("does not show the ready heading unconditionally", () => {
    const hub = readSrc("components/carer/CarerOnboardingHub.tsx");
    expect(hub).toContain("Onboarding not complete");
    expect(hub).toMatch(/canFinish \? "You're ready to finish setup"/);
  });
});

describe("carer document status presentation", () => {
  it("uses a single carer-facing status line instead of separate review/expiry pills", () => {
    const form = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(form).toContain("CarerDocumentStatusLine");
    expect(form).toContain("carerDocumentCarerFacingStatus");
    expect(form).not.toContain("ReviewStatusPill");
    expect(form).not.toContain("ExpiryStatusPill");
  });
});

describe("carer password reset copy", () => {
  it("preserves 60-minute reset lifetime messaging", () => {
    const forgot = readSrc("routes/carer/forgot-password.tsx");
    const reset = readSrc("routes/carer/reset-password.$token.tsx");
    expect(forgot).toContain("60 minutes");
    expect(reset).toContain("60 minutes");
    expect(forgot).not.toMatch(/24 hours|7 days/i);
    expect(reset).not.toMatch(/24 hours|7 days/i);
  });
});
