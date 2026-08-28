import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ONBOARDING_SAVING_CHANGES_LABEL,
  ONBOARDING_STEP_2_REQUIRED_FIELDS_NOTE,
} from "./carer-onboarding-save-state";

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
    expect(form()).toMatch(/mode === "onboarding" \? \([\s\S]*CarerOnboardingForwardButton/);
    expect(form()).toMatch(/mode !== "onboarding"[\s\S]*Discard changes/);
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
  const form = () => readSrc("components/carer/CarerDocumentsForm.tsx");
  const route = () => readSrc("routes/carer/onboarding/documents.tsx");

  it("reports saving and requirements state separately to the shell", () => {
    expect(form()).toContain("onOnboardingStepStateChange");
    expect(form()).toContain("onboardingStepSaving");
    expect(form()).toContain("requirementsComplete");
    expect(form()).toContain("showRequiredFieldsNote");
    expect(form()).toContain("dateSavePending");
    expect(form()).toMatch(
      /onboardingStepSaving\s*=[\s\S]*\(saving \|\| advancing \|\| dateSavePending\)/,
    );
    expect(route()).toContain("onOnboardingStepStateChange={setStep2State}");
    expect(route()).toContain("CarerOnboardingForwardButton");
    expect(route()).toContain("disabled={!step2State.requirementsComplete}");
    expect(route()).toContain("saving={step2State.saving}");
  });

  it("uses clearCategory when removing the last saved file in onboarding", () => {
    expect(form()).toContain("clearCategoryImmediate");
    expect(form()).toContain("carerDocumentsApi.clearCategory");
    expect(form()).toContain("countDraftFiles");
  });

  it("shows required-fields note only when saved but incomplete", () => {
    expect(ONBOARDING_STEP_2_REQUIRED_FIELDS_NOTE).toBe(
      "There are still required fields that need attention.",
    );
    expect(route()).toContain("ONBOARDING_STEP_2_REQUIRED_FIELDS_NOTE");
    expect(route()).toContain("step2State.showRequiredFieldsNote");
    expect(form()).toMatch(/showRequiredFieldsNote[\s\S]*!onboardingStepSaving[\s\S]*!isDirty/);
  });

  it("derives requirementsComplete from canCompleteStep2 when drafts are synced", () => {
    expect(form()).toContain("canCompleteStep2");
    expect(form()).toMatch(/requirementsComplete[\s\S]*canCompleteStep2[\s\S]*!isDirty/);
  });

  it("disables go back only while saving, not when requirements are incomplete", () => {
    expect(route()).toContain("disabled={step2State.saving}");
    expect(route()).toContain("Go back");
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
    expect(route).toContain("disabled={stepSaving}");
    expect(route).toContain("Go back");
  });
});

describe("step 2 continue hardening preserved", () => {
  it("still flushes pending date saves before continuing", () => {
    const form = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(form).toContain("flushPendingOnboardingDateSaves");
    expect(form).toMatch(/handleNext[\s\S]*flushPendingOnboardingDateSaves[\s\S]*saveDirtyCategories/);
  });
});

describe("step 2 optional documents regression", () => {
  it("uses server canCompleteStep2 which excludes optional qualification documents", () => {
    const apiLib = readSrc("lib/carer-documents.ts");
    expect(apiLib).toContain("canCompleteStep2");
  });
});

describe("normal documents page regression", () => {
  it("does not wire onboarding step state on the account documents route", () => {
    const accountRoute = readSrc("routes/carer/documents.tsx");
    expect(accountRoute).not.toContain("onOnboardingStepStateChange");
    expect(accountRoute).not.toContain("ONBOARDING_STEP_2_REQUIRED_FIELDS_NOTE");
  });
});
