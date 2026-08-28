import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { CARER_LOGIN_PATH, resolveUnusableInviteRedirect } from "./carer-invite-routing";
import { carerLandingPath } from "./carer-onboarding";
import { carerSessionFixture } from "./carer-session-fixtures";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("resolveUnusableInviteRedirect", () => {
  it("redirects to carer login when no staff session", async () => {
    await expect(
      resolveUnusableInviteRedirect({
        getSession: vi.fn().mockRejectedValue(new Error("401")),
      }),
    ).resolves.toBe(CARER_LOGIN_PATH);
  });

  it("redirects incomplete onboarding to resume path", async () => {
    await expect(
      resolveUnusableInviteRedirect({
        getSession: vi.fn().mockResolvedValue(carerSessionFixture()),
      }),
    ).resolves.toBe("/carer/onboarding/intro");
  });

  it("redirects fully onboarded carers to portal home", async () => {
    await expect(
      resolveUnusableInviteRedirect({
        getSession: vi.fn().mockResolvedValue(
          carerSessionFixture({
            onboardingCompletedAt: "2026-01-02T00:00:00.000Z",
            onboardingComplete: true,
          }),
        ),
      }),
    ).resolves.toBe("/carer");
  });
});

describe("carerLandingPath integration", () => {
  it("sends incomplete users to onboarding intro", () => {
    expect(carerLandingPath(carerSessionFixture())).toBe("/carer/onboarding/intro");
  });
});

describe("invite route smart redirect policy", () => {
  it("validates invite in beforeLoad before any session redirect", () => {
    const invite = readSrc("routes/carer/invite.$token.tsx");
    expect(invite).toContain("beforeLoad");
    expect(invite).toContain("carerAuthApi.invite");
    expect(invite).toContain("resolveUnusableInviteRedirect");
  });
});
