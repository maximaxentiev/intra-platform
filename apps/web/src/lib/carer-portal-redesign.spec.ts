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
  it("leads with shifts, then availability, then account shortcuts", () => {
    const home = readSrc("routes/carer/index.tsx");
    expect(home).toContain("CarerShiftsDashboardSummary");
    expect(home).toContain("CarerAvailabilityDashboardSummary");
    expect(home).toContain("carerGreeting");
    expect(home.indexOf("CarerShiftsDashboardSummary />")).toBeLessThan(
      home.indexOf("CarerAvailabilityDashboardSummary />"),
    );
  });
});
