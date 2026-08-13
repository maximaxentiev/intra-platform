import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer onboarding routing", () => {
  it("gates portal home through onboarding resume", () => {
    const src = readSrc("routes/carer/index.tsx");
    expect(src).toContain("carerOnboardingResumePath");
  });

  it("blocks skipping ahead of completed steps", () => {
    const src = readSrc("lib/carer-route-guards.ts");
    expect(src).toContain("assertOnboardingStepAccess");
    expect(src).toContain("maxAccessibleOnboardingStep");
  });

  it("documents step uses the real documents workflow", () => {
    const route = readSrc("routes/carer/onboarding/documents.tsx");
    const form = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(route).toContain("CarerDocumentsForm");
    expect(route).toContain("carerDocumentsApi.get");
    expect(route).not.toContain("not available yet");
    expect(form).toContain("useUnsavedChangesGuard");
    expect(form).toContain("completeStep2");
    expect(form).toContain("retainFileIds");
  });

  it("personal information form supports save discard next", () => {
    const src = readSrc("components/carer/CarerPersonalInformationForm.tsx");
    expect(src).toContain("Discard");
    expect(src).toContain("Save these changes and continue");
    expect(src).toContain("useUnsavedChangesGuard");
  });

  it("profile step avoids horizontal overflow on small screens", () => {
    const form = readSrc("components/carer/CarerPersonalInformationForm.tsx");
    expect(form).toContain("overflow-x-hidden");
    expect(form).toContain("min-w-0");
  });

  it("onboarding progress links to unlocked earlier steps", () => {
    const shell = readSrc("components/carer/CarerOnboardingShell.tsx");
    expect(shell).toContain("isOnboardingStepNavigable");
    expect(shell).toContain("<Link");
    expect(shell).toContain('aria-current={isViewing ? "step" : undefined}');
    expect(shell).not.toMatch(/onClick=.*navigate/i);
  });

  it("availability step uses the shared availability editor", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    expect(route).toContain("CarerAvailabilityEditor");
    expect(route).toContain("carerAvailabilityApi.list");
    expect(route).toContain("Back to Documents");
    expect(route).toContain("stepPathForNumber(2)");
  });

  it("route guards allow backward navigation without rewinding onboarding", () => {
    const guards = readSrc("lib/carer-route-guards.ts");
    expect(guards).toContain("required > allowed");
    expect(guards).not.toMatch(/onboardingStep\s*=|profileCompletedAt\s*=/);
  });
});
