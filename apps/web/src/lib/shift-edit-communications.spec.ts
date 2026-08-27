import { describe, expect, it } from "vitest";
import {
  detectShiftEditCommunicationChanges,
  hasShiftEditCommunicationChanges,
} from "./shift-edit-communications";

describe("detectShiftEditCommunicationChanges", () => {
  const base = {
    shiftDate: "2026-08-28",
    startTime: "08:00:00",
    endTime: "16:00:00",
    roleNeeded: "ECE",
  };

  it("returns no changes when values match", () => {
    expect(detectShiftEditCommunicationChanges(base, base)).toEqual([]);
    expect(hasShiftEditCommunicationChanges([])).toBe(false);
  });

  it("detects date, time, and role changes", () => {
    const after = {
      ...base,
      shiftDate: "2026-08-29",
      startTime: "09:00:00",
      roleNeeded: "RECE",
    };
    expect(detectShiftEditCommunicationChanges(base, after).map((c) => c.field)).toEqual([
      "date",
      "time",
      "role",
    ]);
  });

  it("treats end time only as Time", () => {
    const after = { ...base, endTime: "17:00:00" };
    expect(detectShiftEditCommunicationChanges(base, after).map((c) => c.field)).toEqual(["time"]);
  });

  it("returns no changes when edited value matches original", () => {
    const after = { ...base, shiftDate: "2026-08-28" };
    expect(detectShiftEditCommunicationChanges(base, after)).toEqual([]);
  });
});
