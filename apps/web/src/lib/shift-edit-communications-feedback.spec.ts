import { describe, expect, it } from "vitest";
import { shiftUpdateFeedbackMessage } from "./shift-edit-communications-feedback";

describe("shiftUpdateFeedbackMessage", () => {
  it("reports success when no communications requested", () => {
    expect(shiftUpdateFeedbackMessage(null)).toBe("Shift updated.");
  });

  it("reports partial failure", () => {
    expect(
      shiftUpdateFeedbackMessage({
        centre: { attempted: true, sent: true },
        carer: { attempted: true, sent: false },
      }),
    ).toBe("Shift updated. Centre email sent. Carer email could not be sent.");
  });

  it("reports both sent", () => {
    expect(
      shiftUpdateFeedbackMessage({
        centre: { attempted: true, sent: true },
        carer: { attempted: true, sent: true },
      }),
    ).toBe("Shift updated. Centre and Carer emails sent.");
  });
});
