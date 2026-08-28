import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INTRA_LOGO_PURPLE_ASSET } from "@/components/auth/IntraAuthLogo";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("platform login branding", () => {
  it("uses the official purple Intra logo asset on auth surfaces", () => {
    expect(INTRA_LOGO_PURPLE_ASSET).toContain("intra-logo-purple");
    for (const rel of [
      "routes/index.tsx",
      "routes/auth/index.tsx",
      "routes/auth/change-password.tsx",
      "components/carer/CarerAuthCard.tsx",
    ]) {
      const src = readSrc(rel);
      expect(src).toContain("IntraAuthLogo");
      expect(src).not.toMatch(/\bIN\b.*font-bold/);
    }
  });

  it("shows Welcome to the Intra Platform on the auth landing page", () => {
    const landing = readSrc("routes/index.tsx");
    expect(landing).toContain("Welcome to the Intra Platform");
    expect(landing).not.toContain("Welcome to Intra");
  });

  it("labels the first role option Intra Operations Team and keeps Independent Carer unchanged", () => {
    const landing = readSrc("routes/index.tsx");
    expect(landing).toContain('title: "Intra Operations Team"');
    expect(landing).toContain('title: "Independent Carer"');
    expect(landing).not.toContain("Ops Team");
    expect(landing).not.toMatch(/title: "Carer"/);
  });

  it("keeps role routes attached to each option", () => {
    const landing = readSrc("routes/index.tsx");
    expect(landing).toContain('to: "/auth"');
    expect(landing).toContain('to: "/carer/login"');
  });

  it("uses branded purple hover/focus role card treatment", () => {
    const card = readSrc("components/auth/AuthRoleOptionCard.tsx");
    expect(card).toContain("hover:bg-primary");
    expect(card).toContain("hover:text-primary-foreground");
    expect(card).toContain("focus-visible:bg-primary");
    expect(card).toContain("group-hover:text-primary-foreground");
    expect(card).toContain("bg-primary-soft");
  });

  it("renders auth child routes through the auth layout Outlet", () => {
    const layout = readSrc("routes/auth/route.tsx");
    expect(layout).toContain("<Outlet");
  });

  it("preserves ops login behavior and forced-password routing", () => {
    const login = readSrc("routes/auth/index.tsx");
    const change = readSrc("routes/auth/change-password.tsx");
    expect(login).toContain("authApi.login");
    expect(login).toContain("resolveOpsPostLoginNavigation");
    expect(change).toContain("replacePassword");
    expect(change).toContain("requiresForcedPasswordChange");
    expect(change).toContain('/auth/change-password');
  });

  it("preserves carer login rendering and session API", () => {
    const carerLogin = readSrc("routes/carer/login.tsx");
    const card = readSrc("components/carer/CarerAuthCard.tsx");
    expect(carerLogin).toContain("CarerAuthCard");
    expect(carerLogin).toContain("carerAuthApi.login");
    expect(card).toContain("Carer Portal");
    expect(card).toContain("Back to sign-in options");
  });

  it("identifies the ops login page as Intra Operations Team", () => {
    const login = readSrc("routes/auth/index.tsx");
    expect(login).toContain("Intra Operations Team");
    expect(login).toContain("Sign in to the Intra Platform");
  });
});
