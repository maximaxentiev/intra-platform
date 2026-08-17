import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("ops vs carer auth separation", () => {
  it("uses ops authApi for authenticated ops routes", () => {
    const route = readSrc("routes/_authenticated/route.tsx");
    expect(route).toContain("authApi.session");
    expect(route).not.toContain("carerAuthApi");
  });

  it("uses carerAuthApi only under carer routes", () => {
    const authRoute = readSrc("routes/auth.tsx");
    expect(authRoute).not.toContain("carerAuthApi");

    const carerLogin = readSrc("routes/carer/login.tsx");
    expect(carerLogin).toContain("carerAuthApi");
    expect(carerLogin).not.toMatch(/from "@\/lib\/db"/);
  });

  it("carer route guards redirect to carer login, not ops auth", () => {
    const guards = readSrc("lib/carer-route-guards.ts");
    expect(guards).toContain('to: "/carer/login"');
    expect(guards).not.toContain('to: "/auth"');
    expect(guards).toContain("onboardingComplete(session)");
  });

  it("portal home reuses requireCarerSessionForPortal guard", () => {
    const home = readSrc("routes/carer/index.tsx");
    expect(home).toContain("requireCarerSessionForPortal");
    expect(home).not.toContain("carerAuthApi.session");
  });
});

describe("carer portal stabilization invariants", () => {
  it("does not import legacy week editor component", () => {
    const routes = readSrc("routes/carer/availability.tsx");
    expect(routes).not.toContain("CarerAvailabilityEditor");
  });

  it("onboarding completion uses authoritative session booleans", () => {
    const session = readSrc("lib/carer.ts");
    expect(session).toContain("onboardingCompletedAt");
    expect(session).toContain("profileCompletedAt");
    expect(session).toContain("documentsCompletedAt");
    expect(session).toContain("availabilityCompletedAt");
    expect(session).toContain("onboardingComplete");
  });

  it("onboarding completion banner uses transient router state only", () => {
    const completion = readSrc("lib/carer-onboarding-completion.ts");
    expect(completion).not.toContain("localStorage");
    expect(completion).not.toContain("sessionStorage");
  });

  it("shift matching is not wired to carer availability UI", () => {
    const carerHome = readSrc("routes/carer/index.tsx");
    expect(carerHome).toContain("CarerShiftsDashboardSummary");
    expect(carerHome).not.toContain("available-staff");
  });

  it("carer shifts UI does not compare against availability data", () => {
    const manager = readSrc("components/carer/CarerShiftsManager.tsx");
    const queries = readSrc("lib/carer-shifts-queries.ts");
    expect(manager).not.toContain("carerAvailabilityApi");
    expect(manager).not.toContain("useCarerUpcomingAvailability");
    expect(queries).not.toContain("carer-availability");
  });
});

describe("carer portal feature flag parity", () => {
  it("documents env example values for API and web flags", () => {
    const envExample = readFileSync(join(webRoot, "../../../.env.example"), "utf8");
    expect(envExample).toContain("CARER_PORTAL_ENABLED");
    expect(envExample).toContain("VITE_CARER_PORTAL_ENABLED");
  });
});
