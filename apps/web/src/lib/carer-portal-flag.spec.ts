import { describe, expect, it } from "vitest";
import { isCarerPortalEnabled } from "./carer-portal-flag";

describe("isCarerPortalEnabled", () => {
  it("is false unless VITE_CARER_PORTAL_ENABLED is true", () => {
    expect(isCarerPortalEnabled()).toBe(
      import.meta.env.VITE_CARER_PORTAL_ENABLED === "true",
    );
  });
});
