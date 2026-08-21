import { describe, expect, it } from "vitest";
import type { DashboardOverviewResponse } from "./dashboard-api";
import {
  activityActorLine,
  communicationAttentionMessage,
  communicationFailureLabel,
  complianceHeadline,
  describeShiftUrgency,
  documentAttentionMessages,
  formatDashboardHeaderDate,
  formatDurationMinutes,
  formatFillRate,
  formatShiftClock,
  formatShiftTimeRange,
  formatUpcomingDateLabel,
  hasAttentionItems,
  next7DaysShiftsSearch,
  todayShiftsSearch,
  urgentPendingShiftSummary,
} from "./dashboard-overview-ui";

const emptyAttention: DashboardOverviewResponse["attention"] = {
  urgentPendingShifts: [],
  totalUrgentPendingCount: 0,
  hasMoreUrgentPending: false,
  documents: { pendingReview: 0, issueFlagged: 0, expired: 0 },
  communications: {
    windowHours: 24,
    failedAssignmentConfirmations: 0,
    failedAutomatedCommunications: 0,
    totalFailures: 0,
    recentFailures: [],
  },
};

describe("dashboard header", () => {
  it("formats the server-provided Toronto business date", () => {
    expect(formatDashboardHeaderDate("2026-08-21")).toBe("Friday, August 21 · Toronto");
  });
});

describe("shift time formatting", () => {
  it("formats 24h clock values", () => {
    expect(formatShiftClock("08:00")).toBe("8:00 AM");
    expect(formatShiftClock("17:30:00")).toBe("5:30 PM");
    expect(formatShiftClock("00:15")).toBe("12:15 AM");
    expect(formatShiftClock(null)).toBe("—");
  });

  it("formats a range", () => {
    expect(formatShiftTimeRange("08:00", "16:00")).toBe("8:00 AM – 4:00 PM");
  });
});

describe("urgency", () => {
  it("humanises durations", () => {
    expect(formatDurationMinutes(45)).toBe("45m");
    expect(formatDurationMinutes(80)).toBe("1h 20m");
    expect(formatDurationMinutes(120)).toBe("2h");
  });

  it("renders upcoming urgency", () => {
    expect(describeShiftUrgency(80).label).toBe("Starts in 1h 20m");
    expect(describeShiftUrgency(35).level).toBe("critical");
    expect(describeShiftUrgency(600).level).toBe("upcoming");
  });

  it("never renders raw negative minutes", () => {
    const urgency = describeShiftUrgency(-25, { unfilled: true });
    expect(urgency.label).toBe("Started 25m ago · Still unfilled");
    expect(urgency.label).not.toContain("-");
    expect(urgency.overdue).toBe(true);
  });

  it("summarises an urgent pending shift", () => {
    expect(
      urgentPendingShiftSummary({
        shiftId: "s1",
        shiftDate: "2026-08-21",
        startTime: "11:30",
        endTime: "17:00",
        centreId: "c1",
        centreName: "ABC Child Care",
        role: "ECE",
        status: "pending",
        startsAt: "2026-08-21T15:30:00.000Z",
        minutesUntilStart: 80,
      }),
    ).toBe("ECE · 11:30 AM");
  });
});

describe("needs attention", () => {
  it("only surfaces document counts greater than zero", () => {
    expect(documentAttentionMessages({ pendingReview: 0, issueFlagged: 0, expired: 0 })).toEqual([]);
    expect(documentAttentionMessages({ pendingReview: 4, issueFlagged: 2, expired: 3 })).toEqual([
      "4 staff documents awaiting review",
      "2 staff have flagged document issues",
      "3 staff have expired required documents",
    ]);
  });

  it("uses singular copy for one item", () => {
    expect(documentAttentionMessages({ pendingReview: 1, issueFlagged: 1, expired: 1 })).toEqual([
      "1 staff document awaiting review",
      "1 staff has flagged document issues",
      "1 staff has expired required documents",
    ]);
  });

  it("shows communication failures only when the 24h window has any", () => {
    expect(communicationAttentionMessage(0)).toBeNull();
    expect(communicationAttentionMessage(2)).toBe("2 communications need attention");
    expect(communicationAttentionMessage(1)).toBe("1 communication needs attention");
  });

  it("labels failures without exposing message content", () => {
    expect(
      communicationFailureLabel({
        type: "assignment_confirmation",
        centreName: "Little Steps",
        staffName: "Sarah Khan",
      }),
    ).toBe("Assignment confirmation · Sarah Khan");
    expect(
      communicationFailureLabel({
        type: "automated_communication",
        centreName: null,
        staffName: null,
      }),
    ).toBe("Automated communication");
  });

  it("detects the all-caught-up state", () => {
    expect(hasAttentionItems(emptyAttention)).toBe(false);
    expect(
      hasAttentionItems({
        ...emptyAttention,
        documents: { pendingReview: 1, issueFlagged: 0, expired: 0 },
      }),
    ).toBe(true);
    expect(
      hasAttentionItems({
        ...emptyAttention,
        communications: { ...emptyAttention.communications, totalFailures: 3 },
      }),
    ).toBe(true);
  });
});

describe("next 7 days", () => {
  it("renders an em dash for a null fill rate", () => {
    expect(formatFillRate(null)).toBe("—");
  });

  it("formats fractional and percentage fill rates", () => {
    expect(formatFillRate(0.82)).toBe("82%");
    expect(formatFillRate(76)).toBe("76%");
    expect(formatFillRate(0)).toBe("0%");
  });

  it("labels upcoming dates relative to the Toronto business date", () => {
    const context = { today: "2026-08-21", tomorrow: "2026-08-22" };
    expect(formatUpcomingDateLabel("2026-08-21", context)).toBe("Today");
    expect(formatUpcomingDateLabel("2026-08-22", context)).toBe("Tomorrow");
    expect(formatUpcomingDateLabel("2026-08-24", context)).toBe("Mon, Aug 24");
  });
});

describe("shift links", () => {
  it("uses only supported /shifts query parameters", () => {
    expect(todayShiftsSearch("2026-08-21")).toEqual({ from: "2026-08-21", to: "2026-08-21" });
    expect(todayShiftsSearch("2026-08-21", "pending")).toEqual({
      from: "2026-08-21",
      to: "2026-08-21",
      status: "pending",
    });
    expect(
      next7DaysShiftsSearch({ dateFrom: "2026-08-22", dateTo: "2026-08-28" }, "pending"),
    ).toEqual({ from: "2026-08-22", to: "2026-08-28", status: "pending" });
    expect(
      Object.keys(next7DaysShiftsSearch({ dateFrom: "2026-08-22", dateTo: "2026-08-28" })),
    ).toEqual(["from", "to"]);
  });
});

describe("workforce readiness", () => {
  it("builds the compliance headline", () => {
    expect(complianceHeadline({ compliant: 247, staffShown: 263 })).toEqual({
      value: "247 compliant",
      context: "of 263 active staff",
    });
  });
});

describe("recent activity", () => {
  it("renders the Toronto time and actor", () => {
    const line = activityActorLine({
      occurredAt: "2026-08-21T14:42:00.000Z",
      actor: { name: "Max", type: "ops_user" },
    });
    expect(line).toBe("10:42 AM · by Max");
  });

  it("falls back to system attribution", () => {
    expect(
      activityActorLine({
        occurredAt: "2026-08-21T14:42:00.000Z",
        actor: { name: null, type: "system" },
      }),
    ).toBe("10:42 AM · by system");
  });
});
