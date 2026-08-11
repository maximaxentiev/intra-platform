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
});
