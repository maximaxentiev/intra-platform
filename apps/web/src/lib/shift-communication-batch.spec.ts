import { describe, expect, it } from "vitest";
import { applyBatchCentreDeferral, BATCH_CENTRE_DEFER_MESSAGE } from "./shift-communication-batch";

describe("applyBatchCentreDeferral", () => {
  it("defers centre when batch is open", () => {
    const result = applyBatchCentreDeferral({ available: true }, true);
    expect(result.available).toBe(false);
    expect(result.reason).toBe(BATCH_CENTRE_DEFER_MESSAGE);
    expect(result.unavailableCode).toBe("deferred_open_batch");
  });

  it("preserves availability when batch is not deferring centre", () => {
    const probe = { available: false, reason: "No email" };
    expect(applyBatchCentreDeferral(probe, false)).toEqual(probe);
  });
});
