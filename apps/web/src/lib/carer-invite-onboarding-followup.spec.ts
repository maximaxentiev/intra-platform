import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer onboarding revisit navigation", () => {
  it("documents page links back to personal information", () => {
    const form = readSrc("components/carer/CarerDocumentsForm.tsx");
    const backLink = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(backLink).toContain("/carer/onboarding/profile");
    expect(form).toMatch(/Personal Information/);
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
