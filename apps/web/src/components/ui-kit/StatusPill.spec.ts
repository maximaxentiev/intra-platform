import { describe, expect, it } from "vitest";
import { resolveStatusTone } from "./StatusPill";

describe("resolveStatusTone", () => {
  it("keeps known operational tones", () => {
    for (const tone of [
      "pending",
      "filled",
      "completed",
      "cancelled",
      "active",
      "inactive",
      "disabled",
      "neutral",
    ] as const) {
      expect(resolveStatusTone(tone)).toBe(tone);
    }
  });

  it("falls back to neutral for unknown statuses", () => {
    expect(resolveStatusTone("awaiting_review")).toBe("neutral");
    expect(resolveStatusTone("")).toBe("neutral");
  });

  it("does not resolve inherited object properties as tones", () => {
    expect(resolveStatusTone("constructor")).toBe("neutral");
    expect(resolveStatusTone("toString")).toBe("neutral");
  });
});
