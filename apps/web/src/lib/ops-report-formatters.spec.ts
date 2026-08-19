import { describe, expect, it } from "vitest";
import {
  formatOpsDateTimeToronto,
  formatOpsDateToronto,
  formatReportDurationMinutes,
  formatReportFillRatePercent,
  OPS_REPORT_TIMEZONE,
} from "./ops-report-formatters";

describe("ops report formatters", () => {
  it("uses America/Toronto explicitly", () => {
    expect(OPS_REPORT_TIMEZONE).toBe("America/Toronto");
  });

  it("formats UTC instant on a different Toronto calendar date", () => {
    expect(formatOpsDateToronto("2026-08-13T03:30:00.000Z")).toBe("August 12, 2026");
  });

  it("formats Toronto datetime without browser-local assumptions", () => {
    const formatted = formatOpsDateTimeToronto("2026-08-13T18:45:00.000Z");
    expect(formatted).toContain("Aug");
    expect(formatted).toContain("13");
    expect(formatted).toContain("2026");
  });

  it("formats integer minutes as readable durations", () => {
    expect(formatReportDurationMinutes(480)).toBe("8h");
    expect(formatReportDurationMinutes(450)).toBe("7h 30m");
    expect(formatReportDurationMinutes(60)).toBe("1h");
    expect(formatReportDurationMinutes(45)).toBe("45m");
    expect(formatReportDurationMinutes(0)).toBe("0m");
  });

  it("formats null fill rate as em dash", () => {
    expect(formatReportFillRatePercent(null)).toBe("—");
    expect(formatReportFillRatePercent(87.5)).toBe("87.5%");
  });
});
