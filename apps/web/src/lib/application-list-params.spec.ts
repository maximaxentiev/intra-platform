import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/application-filters-types";
import {
  applicationFiltersToApiParams,
  deserializeApplicationSearch,
  serializeApplicationSearch,
} from "@/lib/application-list-params";

describe("application list URL params", () => {
  it("round-trips filters through search params", () => {
    const state = {
      role: "nanny" as const,
      q: "test",
      page: 2,
      sort: { sortBy: "submittedAt" as const, sortDir: "desc" as const },
      filters: {
        ...EMPTY_FILTERS,
        city: "Toronto",
        hasResume: "yes" as const,
        intakeVersion: ["historical_import"],
        spokenEnglishMin: "8",
      },
    };
    const raw = serializeApplicationSearch(state);
    const parsed = deserializeApplicationSearch(raw);
    expect(parsed.role).toBe("nanny");
    expect(parsed.page).toBe(2);
    expect(parsed.q).toBe("test");
    expect(parsed.filters.city).toBe("Toronto");
    expect(parsed.filters.hasResume).toBe("yes");
    expect(parsed.filters.intakeVersion).toEqual(["historical_import"]);
    expect(parsed.filters.spokenEnglishMin).toBe("8");
  });

  it("maps filters to API query params", () => {
    const params = applicationFiltersToApiParams(
      "eca",
      "jane",
      { ...EMPTY_FILTERS, status: "new", reviewed: "no" },
      1,
      25,
      {},
    );
    expect(params.role).toBe("eca");
    expect(params.q).toBe("jane");
    expect(params.status).toBe("new");
    expect(params.reviewed).toBe("no");
    expect(params.offset).toBe(25);
  });
});
