import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");

function readSrc(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("carer password reset UI", () => {
  it("login exposes forgot password link", () => {
    const login = readSrc("routes/carer/login.tsx");
    expect(login).toContain('to="/carer/forgot-password"');
    expect(login).toContain("Forgot your password?");
  });

  it("forgot password shows generic confirmation without account enumeration", () => {
    const page = readSrc("routes/carer/forgot-password.tsx");
    expect(page).toContain("Send reset link");
    expect(page).toContain(
      "If an account exists for that email, we've sent password reset instructions.",
    );
    expect(page).not.toMatch(/24 hours|7 days/i);
    expect(page).toContain("60 minutes");
  });

  it("reset route validates token and offers new password form", () => {
    const page = readSrc("routes/carer/reset-password.$token.tsx");
    const api = readSrc("lib/carer.ts");
    expect(page).toContain("/carer/reset-password/$token");
    expect(page).toContain("validateResetPassword");
    expect(page).toContain("New password");
    expect(page).toContain("Confirm password");
    expect(page).toContain("Passwords do not match.");
    expect(page).toContain("invalid or has expired");
    expect(page).toContain('to="/carer/login"');
    expect(api).toContain("resetPassword");
    expect(api).toContain("/staff-auth/reset-password");
  });

  it("keeps invite route distinct from password reset", () => {
    const invite = readSrc("routes/carer/invite.$token.tsx");
    const reset = readSrc("routes/carer/reset-password.$token.tsx");
    expect(invite).toContain("/carer/invite/$token");
    expect(invite).toContain("acceptInvite");
    expect(reset).not.toContain("acceptInvite");
    expect(reset).not.toContain("/carer/invite/");
  });

  it("does not auto-login after password reset", () => {
    const reset = readSrc("routes/carer/reset-password.$token.tsx");
    expect(reset).toContain("resetPassword");
    expect(reset).not.toContain("carerLandingPath");
    expect(reset).not.toContain("carerAuthApi.login");
  });
});
