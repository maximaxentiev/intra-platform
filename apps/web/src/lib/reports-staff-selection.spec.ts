import { describe, expect, it } from "vitest";
import {
  isSingleStaffSelection,
  resolveAppliedStaffSelection,
  staffSelectionLabel,
  staffSelectionToApiQuery,
  staffSelectionToSearchParams,
} from "./reports-staff-selection";

const idA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";

describe("reports staff selection", () => {
  it("defaults to all staff", () => {
    expect(resolveAppliedStaffSelection({})).toEqual({ mode: "all", staffIds: [] });
    expect(staffSelectionToApiQuery({ mode: "all", staffIds: [] })).toEqual({});
  });

  it("parses staffIds from URL", () => {
    expect(resolveAppliedStaffSelection({ staffIds: `${idA},${idB}` })).toEqual({
      mode: "subset",
      staffIds: [idA, idB],
    });
  });

  it("serializes subset selection", () => {
    const selection = { mode: "subset" as const, staffIds: [idA] };
    expect(staffSelectionToSearchParams(selection)).toEqual({ staffIds: idA });
    expect(staffSelectionLabel(selection, [{ id: idA, name: "Jane Smith" }])).toBe("Jane Smith");
  });

  it("detects single-staff selection", () => {
    expect(isSingleStaffSelection({ mode: "subset", staffIds: [idA] })).toBe(true);
    expect(isSingleStaffSelection({ mode: "subset", staffIds: [idA, idB] })).toBe(false);
  });
});
