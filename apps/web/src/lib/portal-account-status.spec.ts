import { describe, expect, it } from "vitest";
import {
  PORTAL_ACCOUNT_STATUS_LABELS,
  portalStatusBadgeVariant,
} from "./portal-account-status";

describe("portal account status badges", () => {
  it("maps all display statuses to readable labels", () => {
    expect(PORTAL_ACCOUNT_STATUS_LABELS.invited).toBe("Invited");
    expect(PORTAL_ACCOUNT_STATUS_LABELS.no_account).toBe("No Account");
  });

  it("uses distinct badge variants for invited vs disabled", () => {
    expect(portalStatusBadgeVariant("invited")).toBe("secondary");
    expect(portalStatusBadgeVariant("disabled")).toBe("destructive");
  });
});
