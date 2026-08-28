import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ONBOARDING_SAVING_CHANGES_LABEL } from "./carer-onboarding-save-state";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("onboarding save-state architecture", () => {
  it("uses a shared forward button with spinner and Saving changes label", () => {
    const button = readSrc("components/carer/CarerOnboardingForwardButton.tsx");
    expect(button).toContain("Loader2");
    expect(button).toContain("ONBOARDING_SAVING_CHANGES_LABEL");
    expect(ONBOARDING_SAVING_CHANGES_LABEL).toBe("Saving changes");
    expect(button).toContain("min-w-[14rem]");
  });
});

describe("step 1 onboarding input styling", () => {
  it("uses bg-surface on onboarding text inputs to match City combobox", () => {
    const form = readSrc("components/carer/CarerPersonalInformationForm.tsx");
    expect(form).toContain('inputClassName="bg-surface"');
    expect(form).toMatch(/mode === "onboarding"[\s\S]*inputClassName="bg-surface"/);
  });

  it("does not apply bg-surface to profile mode inputs", () => {
    const form = readSrc("components/carer/CarerPersonalInformationForm.tsx");
    expect(form).not.toMatch(/mode === "profile"[\s\S]*inputClassName="bg-surface"/);
  });
});

describe("step 1 save-state behavior", () => {
  const form = () => readSrc("components/carer/CarerPersonalInformationForm.tsx");

  it("removes Discard from onboarding mode", () => {
    expect(form()).toContain("CarerOnboardingForwardButton");
    expect(form()).not.toMatch(/mode === "onboarding"[\s\S]*Discard/);
  });

  it("tracks debounce, request, and continue saving states", () => {
    expect(form()).toContain("autosavePending");
    expect(form()).toContain("continuing");
    expect(form()).toContain("autosaveFailed");
    expect(form()).toContain("onboardingSaving");
    expect(form()).toContain("onboardingCanContinue");
  });

  it("blocks continue while unsaved valid changes exist", () => {
    expect(form()).toContain("hasUnsavedValidChanges");
    expect(form()).toMatch(/disabled=\{!onboardingCanContinue\}/);
  });
});

describe("step 2 save-state behavior", () => {
  it("reports step saving state to the shell forward button", () => {
    const form = readSrc("components/carer/CarerDocumentsForm.tsx");
    const route = readSrc("routes/carer/onboarding/documents.tsx");
    expect(form).toContain("onOnboardingSavingChange");
    expect(form).toContain("onboardingStepSaving");
    expect(route).toContain("CarerOnboardingForwardButton");
    expect(route).toContain("onOnboardingSavingChange={setStepSaving}");
    expect(route).toContain("disabled={stepSaving}");
  });
});

describe("step 3 save-state behavior", () => {
  it("disables complete and go back while availability mutations or completion run", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    const wizard = readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");
    expect(wizard).toContain("onBusyChange");
    expect(route).toContain("onBusyChange={setAvailabilityBusy}");
    expect(route).toContain("const stepSaving = completing || availabilityBusy");
    expect(route).toContain("if (stepSaving) return");
    expect(route).toMatch(/Go back[\s\S]*disabled=\{stepSaving\}/);
  });
});

describe("step 2 continue hardening preserved", () => {
  it("still flushes pending date saves before continuing", () => {
    const form = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(form).toContain("flushPendingOnboardingDateSaves");
    expect(form).toMatch(/handleNext[\s\S]*flushPendingOnboardingDateSaves[\s\S]*saveDirtyCategories/);
  });
});
