import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("ops staff portal UI layout", () => {
  it("manual staff form avoids horizontal overflow on small screens", () => {
    const src = readSrc("components/ManualStaffCreateForm.tsx");
    expect(src).toContain("overflow-x-hidden");
    expect(src).toContain("min-w-0");
  });

  it("staff list shows portal account status badges", () => {
    const src = readSrc("routes/_authenticated/staff.index.tsx");
    expect(src).toContain("portalAccountStatus");
    expect(src).toContain("PORTAL_ACCOUNT_STATUS_LABELS");
    expect(src).toContain("lg:hidden");
    expect(src).toContain("hidden lg:block");
  });

  it("portal account actions require confirmation dialogs", () => {
    const src = readSrc("components/PortalAccountSection.tsx");
    expect(src).toContain("AlertDialog");
    expect(src).toContain("Send portal invitation");
    expect(src).toContain("Resend invitation");
    expect(src).not.toMatch(/inviteToken|invite_token/i);
  });

  it("disabled carer routes use unavailable screen instead of ops auth redirect", () => {
    const route = readSrc("routes/carer/route.tsx");
    expect(route).toContain("CarerPortalUnavailable");
    expect(route).not.toContain('to: "/auth"');
    const routing = readSrc("lib/carer-portal-routing.ts");
    expect(routing).toContain("show-unavailable");
  });
});
