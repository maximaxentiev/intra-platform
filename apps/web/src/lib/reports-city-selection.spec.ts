import { describe, expect, it } from "vitest";
import {
  citySelectionToApiQuery,
  citySelectionToSearchParams,
  parseCitiesParam,
  resolveAppliedCitySelection,
  serializeCitiesParam,
} from "./reports-city-selection";
import type { CitySelectionState } from "./reports-city-selection";

describe("reports-city-selection", () => {
  it("parses canonical cities case-insensitively and ignores unknown values", () => {
    expect(parseCitiesParam("toronto, Mississauga, Unknown")).toEqual([
      "Toronto",
      "Mississauga",
    ]);
  });

  it("treats empty city selection as all cities", () => {
    expect(resolveAppliedCitySelection({})).toEqual({ mode: "all", cities: [] });
    expect(citySelectionToApiQuery({ mode: "all", cities: [] })).toEqual({});
    expect(citySelectionToSearchParams({ mode: "all", cities: [] })).toEqual({});
  });

  it("serializes selected cities for URL and API query", () => {
    const selection = { mode: "subset" as const, cities: ["Toronto", "Ottawa"] as CitySelectionState["cities"] };
    expect(citySelectionToSearchParams(selection)).toEqual({ cities: "Toronto,Ottawa" });
    expect(citySelectionToApiQuery(selection)).toEqual({ cities: ["Toronto", "Ottawa"] });
    expect(serializeCitiesParam(["Toronto", "Ottawa"])).toBe("Toronto,Ottawa");
  });

  it("resolves applied city selection from search params", () => {
    expect(resolveAppliedCitySelection({ cities: "Toronto,Ottawa" })).toEqual({
      mode: "subset",
      cities: ["Toronto", "Ottawa"],
    });
  });
});
