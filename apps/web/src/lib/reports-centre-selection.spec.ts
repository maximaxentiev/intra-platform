import { describe, expect, it } from "vitest";
import {
  centreSelectionLabel,
  centreSelectionToApiQuery,
  centreSelectionToSearchParams,
  isSingleCentreSelection,
  parseCentreIdsParam,
  resolveAppliedCentreSelection,
  serializeCentreIdsParam,
} from "./reports-centre-selection";

const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const idB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const idC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";

describe("reports centre selection", () => {
  it("defaults to all centres", () => {
    expect(resolveAppliedCentreSelection({})).toEqual({ mode: "all", centreIds: [] });
    expect(centreSelectionToApiQuery({ mode: "all", centreIds: [] })).toEqual({});
  });

  it("parses comma-separated centreIds from URL", () => {
    expect(parseCentreIdsParam(`${idA},${idB},${idA}`)).toEqual([idA, idB]);
    expect(resolveAppliedCentreSelection({ centreIds: `${idA},${idB}` })).toEqual({
      mode: "subset",
      centreIds: [idA, idB],
    });
  });

  it("supports legacy centreId URL param", () => {
    expect(resolveAppliedCentreSelection({ centreId: idA })).toEqual({
      mode: "subset",
      centreIds: [idA],
    });
  });

  it("serializes subset selection for URL and API", () => {
    const selection = { mode: "subset" as const, centreIds: [idA, idB] };
    expect(centreSelectionToSearchParams(selection)).toEqual({
      centreIds: `${idA},${idB}`,
    });
    expect(centreSelectionToApiQuery(selection)).toEqual({ centreIds: [idA, idB] });
    expect(serializeCentreIdsParam([idA, idB])).toBe(`${idA},${idB}`);
  });

  it("labels selection states", () => {
    const centres = [
      { id: idA, name: "Centre Alpha" },
      { id: idB, name: "Centre Beta" },
    ];
    expect(centreSelectionLabel({ mode: "all", centreIds: [] }, centres)).toBe("All centres");
    expect(centreSelectionLabel({ mode: "subset", centreIds: [idA] }, centres)).toBe(
      "Centre Alpha",
    );
    expect(centreSelectionLabel({ mode: "subset", centreIds: [idA, idB] }, centres)).toBe(
      "2 centres selected",
    );
  });

  it("detects single-centre selection", () => {
    expect(isSingleCentreSelection({ mode: "subset", centreIds: [idA] })).toBe(true);
    expect(isSingleCentreSelection({ mode: "subset", centreIds: [idA, idB] })).toBe(false);
    expect(isSingleCentreSelection({ mode: "all", centreIds: [] })).toBe(false);
  });
});
