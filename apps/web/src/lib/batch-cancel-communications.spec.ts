import { describe, expect, it } from "vitest";
import { buildBatchCancelConfirmPayload } from "./batch-shift-ui";

describe("buildBatchCancelConfirmPayload", () => {
  it("Case B: disables both recipients when No communication is selected", () => {
    expect(
      buildBatchCancelConfirmPayload({
        reason: "Centre closed",
        cancelCase: "B",
        sendCommunication: false,
        centreSelected: false,
        carerSelected: true,
      }),
    ).toEqual({
      reason: "Centre closed",
      communications: { centre: false, carer: false },
    });
  });

  it("Case B: sends Carer communication only when that option is selected", () => {
    expect(
      buildBatchCancelConfirmPayload({
        reason: "Schedule change",
        cancelCase: "B",
        sendCommunication: true,
        centreSelected: false,
        carerSelected: true,
      }),
    ).toEqual({
      reason: "Schedule change",
      communications: { centre: false, carer: true },
    });
  });

  it("Case C: disables both recipients after switching to No communication", () => {
    expect(
      buildBatchCancelConfirmPayload({
        reason: "No longer needed",
        cancelCase: "C",
        sendCommunication: false,
        centreSelected: true,
        carerSelected: true,
      }),
    ).toEqual({
      reason: "No longer needed",
      communications: { centre: false, carer: false },
    });
  });

  it("Case C: honors selected Centre and Carer recipients", () => {
    expect(
      buildBatchCancelConfirmPayload({
        reason: "Both",
        cancelCase: "C",
        sendCommunication: true,
        centreSelected: true,
        carerSelected: true,
      }),
    ).toEqual({
      reason: "Both",
      communications: { centre: true, carer: true },
    });

    expect(
      buildBatchCancelConfirmPayload({
        reason: "Centre only",
        cancelCase: "C",
        sendCommunication: true,
        centreSelected: true,
        carerSelected: false,
      }),
    ).toEqual({
      reason: "Centre only",
      communications: { centre: true, carer: false },
    });
  });

  it("Case A: always submits explicit no-communication payload", () => {
    expect(
      buildBatchCancelConfirmPayload({
        reason: "Withdrawn",
        cancelCase: "A",
        sendCommunication: false,
        centreSelected: false,
        carerSelected: false,
      }),
    ).toEqual({
      reason: "Withdrawn",
      communications: { centre: false, carer: false },
    });
  });
});
