import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countActiveFilters, EMPTY_FILTERS } from "@/components/applications/ApplicationsFilters";

const read = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");

describe("applications advanced filters UI", () => {
  it("uses a right-side sheet with apply footer", () => {
    const src = read("components/applications/ApplicationsFilters.tsx");
    expect(src).toContain("SheetContent");
    expect(src).toContain('side="right"');
    expect(src).toContain("Apply filters");
  });

  it("shows filter count on trigger button", () => {
    const src = read("components/applications/ApplicationsFilters.tsx");
    expect(src).toContain("Filters");
    expect(countActiveFilters({ ...EMPTY_FILTERS, city: "Toronto" })).toBe(1);
  });

  it("loads applications via server list params", () => {
    const page = read("routes/_authenticated/applications.tsx");
    expect(page).toContain("applicationFiltersToApiParams");
    expect(page).not.toContain("fetchAllForRole");
    expect(page).not.toContain("matchesFilters");
  });
});
