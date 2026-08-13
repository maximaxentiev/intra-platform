import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer availability UI contracts", () => {
  it("onboarding step 3 uses the shared availability editor", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    const editor = readSrc("components/carer/CarerAvailabilityEditor.tsx");
    expect(route).toContain("CarerAvailabilityEditor");
    expect(route).toContain("carerAvailabilityApi.list");
    expect(route).toContain("onStepComplete");
    expect(editor).toContain("carerAvailabilityApi.completeStep3");
    expect(route).not.toContain("not available yet");
    expect(route).toContain("Back to Documents");
    expect(editor).toContain("Finish onboarding");
    expect(editor).toContain("Finishing");
  });

  it("account availability route uses the shared editor", () => {
    const route = readSrc("routes/carer/availability.tsx");
    expect(route).toContain("/carer/availability");
    expect(route).toContain("CarerAvailabilityEditor");
    expect(route).toContain("requireCarerSessionForPortal");
    expect(route).not.toContain("Finish onboarding");
  });

  it("carer home links to availability management", () => {
    const home = readSrc("routes/carer/index.tsx");
    expect(home).toContain('to="/carer/availability"');
    expect(home).toContain("Manage availability");
  });

  it("editor hides add and edit on past days", () => {
    const editor = readSrc("components/carer/CarerAvailabilityEditor.tsx");
    expect(editor).toContain("isPastCalendarDate");
    expect(editor).toContain("Add availability");
    expect(editor).toContain("!past");
    expect(editor).toContain("Remove");
  });

  it("editor validates start before end client-side", () => {
    const editor = readSrc("components/carer/CarerAvailabilityEditor.tsx");
    const lib = readSrc("lib/carer-availability.ts");
    expect(editor).toContain("validateClientTimeRange");
    expect(lib).toContain("End time must be after start time");
  });

  it("editor maps overlap API errors for users", () => {
    const editor = readSrc("components/carer/CarerAvailabilityEditor.tsx");
    expect(editor).toContain("mapAvailabilityApiError");
  });

  it("carer availability client never references ops availability API", () => {
    const client = readSrc("lib/carer-availability.ts");
    expect(client).toContain("/staff-portal/availability");
    expect(client).not.toMatch(/['"`]\/availability['"`]/);
    expect(client).not.toContain("staffId");
  });
});
