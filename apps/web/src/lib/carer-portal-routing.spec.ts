import { describe, expect, it } from "vitest";
import { carerPortalParentBehavior } from "./carer-portal-routing";

describe("carerPortalParentBehavior", () => {
  it("shows unavailable screen when carer portal is disabled (never ops /auth redirect)", () => {
    expect(carerPortalParentBehavior(false)).toBe("show-unavailable");
  });

  it("allows carer child routes when enabled", () => {
    expect(carerPortalParentBehavior(true)).toBe("allow-children");
  });
});

describe("disabled carer invite routing policy", () => {
  it("does not map disabled portal to ops auth redirect", () => {
    expect(carerPortalParentBehavior(false)).not.toBe("allow-children");
    const legacyOpsAuthRedirect = "redirect-to-auth";
    expect(carerPortalParentBehavior(false)).not.toBe(legacyOpsAuthRedirect);
  });
});
