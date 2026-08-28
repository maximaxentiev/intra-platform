import { describe, expect, it } from "vitest";
import { buildShiftManualUnassignCentreEmailContent } from "./shift-manual-unassign-centre-email.template";
import { buildShiftManualUnassignCarerEmailContent } from "./shift-manual-unassign-carer-email.template";

describe("shift manual unassign centre email", () => {
  it("uses legal carer name and replacement wording", () => {
    const content = buildShiftManualUnassignCentreEmailContent({
      carerLegalName: "Jane Q. Public",
    });
    expect(content.text).toContain("Jane Q. Public has been unassigned from this Shift request.");
    expect(content.text).toContain("Intra is now working to assign a new Carer as soon as possible.");
    expect(content.text).not.toContain("declined");
  });
});

describe("shift manual unassign carer email", () => {
  it("includes centre and shift context without blame", () => {
    const content = buildShiftManualUnassignCarerEmailContent({
      centreName: "Sunrise Childcare",
      shiftDate: "2026-09-01",
      startTime: "09:00:00",
      endTime: "17:00:00",
      roleNeeded: "RECE",
    });
    expect(content.text).toContain("You have been unassigned from your upcoming Shift at Sunrise Childcare.");
    expect(content.text).toContain("Centre: Sunrise Childcare");
    expect(content.text).toContain("Role: RECE");
    expect(content.text).not.toContain("declined");
  });
});
