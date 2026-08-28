import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer portal simplification — home", () => {
  const home = () => readSrc("routes/carer/index.tsx");
  const dashboard = () => readSrc("components/carer/CarerShiftsDashboardSummary.tsx");
  const previewCard = () => readSrc("components/carer/CarerShiftPreviewCard.tsx");
  const availability = () => readSrc("components/carer/CarerAvailabilityDashboardSummary.tsx");

  it("removes greeting and filler subtitle copy", () => {
    expect(home()).not.toContain("carerGreeting");
    expect(home()).not.toContain("Here's what's coming up.");
    expect(home()).not.toContain("Hi ");
  });

  it("shows at most four upcoming shift preview cards", () => {
    expect(dashboard()).toContain("HOME_PREVIEW_LIMIT = 4");
    expect(dashboard()).toContain(".slice(0, HOME_PREVIEW_LIMIT)");
    expect(dashboard()).toContain("SUMMARY_FETCH_LIMIT = 5");
  });

  it("shows one large empty-state card when no shifts", () => {
    expect(previewCard()).toContain("There are no upcoming shifts right now");
    expect(dashboard()).toContain("CarerShiftPreviewEmptyCard");
  });

  it("renders shift cards with separated centre, date, and time", () => {
    expect(previewCard()).toContain("shift.centre.name");
    expect(previewCard()).toContain("formatDashboardAvailabilityDateLabel");
    expect(previewCard()).toContain("formatAvailabilityWindowDisplay");
  });

  it("links shift cards to shift detail with purple hover styling", () => {
    expect(previewCard()).toContain('to="/carer/shifts/$id"');
    expect(previewCard()).toContain("hover:bg-primary");
    expect(previewCard()).toContain("hover:text-primary-foreground");
  });

  it("shows View more shifts only when more than four exist", () => {
    expect(dashboard()).toContain("hasMoreShifts");
    expect(dashboard()).toContain("View more shifts");
  });

  it("uses static availability preview cards without link styling", () => {
    expect(availability()).toContain("CarerAvailabilityPreviewCard");
    const card = readSrc("components/carer/CarerAvailabilityPreviewCard.tsx");
    expect(card).not.toContain("<Link");
    expect(card).not.toContain("hover:bg-primary");
  });
});

describe("carer portal simplification — shifts", () => {
  const shiftsPage = () => readSrc("routes/carer/shifts.index.tsx");
  const manager = () => readSrc("components/carer/CarerShiftsManager.tsx");
  const card = () => readSrc("components/carer/CarerShiftCard.tsx");

  it("removes assigned-shifts helper copy", () => {
    expect(shiftsPage()).not.toContain("Your assigned shifts.");
    expect(manager()).not.toContain("Shifts you are currently assigned to.");
    expect(manager()).not.toContain("Completed and past assigned shifts.");
  });

  it("uses obvious purple selected tabs and light-purple inactive tabs", () => {
    expect(manager()).toContain('bg-primary text-primary-foreground');
    expect(manager()).toContain("bg-primary-soft text-primary");
  });

  it("uses desktop fixed-column shift rows with view action", () => {
    expect(card()).toContain("md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]");
    expect(card()).toContain("border-r border-border");
    expect(card()).toContain("View shift");
    expect(card()).toContain('to="/carer/shifts/$id"');
  });

  it("uses stacked mobile layout without horizontal scroll tables", () => {
    expect(card()).toContain("md:hidden");
    expect(card()).not.toContain("overflow-x-auto");
  });

  it("uses visible back to portal button", () => {
    expect(shiftsPage()).toContain("CarerBackButton");
    expect(shiftsPage()).toContain('label="Back to portal"');
  });
});

describe("carer portal simplification — shift detail", () => {
  const detail = () => readSrc("components/carer/CarerShiftDetail.tsx");

  it("uses a visible Back to shifts button", () => {
    expect(detail()).toContain('variant="outline"');
    expect(detail()).toContain("Back to shifts");
  });

  it("shows centre rules and notes section", () => {
    expect(detail()).toContain("Centre rules and notes");
    expect(detail()).toContain("centre.notes");
    expect(detail()).toContain("No additional rules or notes.");
  });

  it("still has no carer cancellation actions", () => {
    expect(detail()).not.toMatch(/\bCancel shift\b/);
  });
});

describe("carer portal simplification — availability", () => {
  const route = () => readSrc("routes/carer/availability.tsx");

  it("removes availability intro copy", () => {
    expect(route()).not.toContain("Tell Intra when you can work.");
  });

  it("uses visible back to portal button", () => {
    expect(route()).toContain("CarerBackButton");
  });
});

describe("carer portal simplification — documents", () => {
  const route = () => readSrc("routes/carer/documents.tsx");
  const form = () => readSrc("components/carer/CarerDocumentsForm.tsx");

  it("removes documents intro copy", () => {
    expect(route()).not.toContain("Upload the documents Intra needs for your account.");
  });

  it("removes qualifications optional intro while keeping qualification cards", () => {
    expect(form()).not.toContain("Qualifications (Optional)");
    expect(form()).not.toContain("QUALIFICATIONS_SECTION_COPY");
    expect(form()).toContain("qualificationTypesForStaffRole");
  });

  it("uses prominent document titles and centered account actions", () => {
    expect(form()).toContain('className="text-lg font-bold leading-snug"');
    expect(form()).toContain('mode === "account"');
    expect(form()).toContain("justify-center");
  });
});

describe("carer portal simplification — personal information", () => {
  const route = () => readSrc("routes/carer/profile.tsx");
  const form = () => readSrc("components/carer/CarerPersonalInformationForm.tsx");

  it("removes profile route subtitle", () => {
    expect(route()).not.toContain("Update your contact details.");
  });

  it("removes profile helper copy while keeping field labels", () => {
    expect(form()).toContain('mode === "profile"');
    expect(form()).toContain('label="First name"');
    expect(form()).toContain('label="Email"');
    expect(form()).toContain('label="Address"');
  });

  it("does not show Your details heading in profile mode", () => {
    expect(form()).toContain('mode !== "profile"');
    expect(form()).not.toMatch(/mode === "profile"[\s\S]*Your details/);
  });
});

describe("carer portal simplification — back navigation", () => {
  it("uses consistent secondary back buttons across carer pages", () => {
    const backButton = readSrc("components/carer/CarerBackButton.tsx");
    expect(backButton).toContain('variant="outline"');
    for (const rel of [
      "routes/carer/shifts.index.tsx",
      "routes/carer/availability.tsx",
      "routes/carer/documents.tsx",
      "routes/carer/profile.tsx",
    ]) {
      expect(readSrc(rel)).toContain("CarerBackButton");
    }
  });
});
