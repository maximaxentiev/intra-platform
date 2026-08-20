import { describe, expect, it } from "vitest";
import {
  centreMetricSearchFromRules,
  rulesFromCentreMetricSearch,
  rulesFromStaffUsageSearch,
  staffUsageSearchFromRules,
  validateReportFilterRules,
} from "./report-filter-rules";
import { EMPTY_CENTRE_METRIC_FILTERS } from "./report-centre-metric-filters";
import { CENTRE_USAGE_METRICS, SHIFT_FULFILLMENT_METRICS, STAFF_USAGE_METRICS } from "./report-filter-rules";

describe("report-filter-rules", () => {
  it("reconstructs Pending At least 1 from minPending=1", () => {
    const rules = rulesFromCentreMetricSearch(
      { ...EMPTY_CENTRE_METRIC_FILTERS, pendingMin: "1" },
      SHIFT_FULFILLMENT_METRICS,
    );
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ field: "pending", operator: "gte", value: "1" });
  });

  it("reconstructs Pending At most 5 from maxPending=5", () => {
    const rules = rulesFromCentreMetricSearch(
      { ...EMPTY_CENTRE_METRIC_FILTERS, pendingMax: "5" },
      SHIFT_FULFILLMENT_METRICS,
    );
    expect(rules[0]).toMatchObject({ field: "pending", operator: "lte", value: "5" });
  });

  it("reconstructs Pending Between 1 and 5", () => {
    const rules = rulesFromCentreMetricSearch(
      { ...EMPTY_CENTRE_METRIC_FILTERS, pendingMin: "1", pendingMax: "5" },
      SHIFT_FULFILLMENT_METRICS,
    );
    expect(rules[0]).toMatchObject({ field: "pending", operator: "between", min: "1", max: "5" });
  });

  it("reconstructs Pending Is 5 when min and max match", () => {
    const rules = rulesFromCentreMetricSearch(
      { ...EMPTY_CENTRE_METRIC_FILTERS, pendingMin: "5", pendingMax: "5" },
      SHIFT_FULFILLMENT_METRICS,
    );
    expect(rules[0]).toMatchObject({ field: "pending", operator: "eq", value: "5" });
  });

  it("maps Pending Greater than 5 to minPending=6", () => {
    const search = centreMetricSearchFromRules(
      [
        {
          kind: "numeric",
          field: "pending",
          operator: "gt",
          value: "5",
          min: "",
          max: "",
        },
      ],
      SHIFT_FULFILLMENT_METRICS,
    );
    expect(search.pendingMin).toBe("6");
    expect(search.pendingMax).toBe("");
  });

  it("maps Fill Rate At most 80 to maxFillRate=80", () => {
    const search = centreMetricSearchFromRules(
      [
        {
          kind: "numeric",
          field: "fillRate",
          operator: "lte",
          value: "80",
          min: "",
          max: "",
        },
      ],
      SHIFT_FULFILLMENT_METRICS,
    );
    expect(search.fillRateMax).toBe("80");
  });

  it("maps Scheduled Hours 7.5h to API hours param", () => {
    const search = centreMetricSearchFromRules(
      [
        {
          kind: "numeric",
          field: "scheduledHours",
          operator: "gte",
          value: "7.5",
          min: "",
          max: "",
        },
      ],
      CENTRE_USAGE_METRICS,
    );
    expect(search.scheduledHoursMin).toBe("7.5");
  });

  it("round-trips cross-group centre usage filters", () => {
    const initial = {
      ...EMPTY_CENTRE_METRIC_FILTERS,
      pendingMin: "1",
      fillRateMax: "80",
      scheduledHoursMin: "20",
    };
    const rules = rulesFromCentreMetricSearch(initial, CENTRE_USAGE_METRICS);
    const encoded = centreMetricSearchFromRules(rules, CENTRE_USAGE_METRICS);
    expect(encoded.pendingMin).toBe("1");
    expect(encoded.fillRateMax).toBe("80");
    expect(encoded.scheduledHoursMin).toBe("20");
  });

  it("maps staff role categorical rule to roles param", () => {
    const search = staffUsageSearchFromRules([
      { kind: "enum", field: "role", operator: "in", values: ["ECE", "ECA"] },
    ]);
    expect(search.roles).toEqual(["ECE", "ECA"]);
  });

  it("reconstructs staff usage rules from URL state", () => {
    const rules = rulesFromStaffUsageSearch({
      roles: ["ECE"],
      staffStatuses: [],
      completedShiftsMin: "2",
      completedShiftsMax: "2",
      completedScheduledHoursMin: "",
      completedScheduledHoursMax: "",
      filledShiftsMin: "",
      filledShiftsMax: "",
      filledScheduledHoursMin: "7.5",
      filledScheduledHoursMax: "",
    });
    expect(rules.some((rule) => rule.kind === "enum" && rule.field === "role")).toBe(true);
    expect(rules.some((rule) => rule.kind === "numeric" && rule.field === "completedShifts" && rule.operator === "eq")).toBe(true);
    expect(rules.some((rule) => rule.kind === "numeric" && rule.field === "filledScheduledHours" && rule.operator === "gte")).toBe(true);
  });

  it("rejects duplicate metric rules", () => {
    const error = validateReportFilterRules(
      [
        {
          kind: "numeric",
          field: "pending",
          operator: "gte",
          value: "1",
          min: "",
          max: "",
        },
        {
          kind: "numeric",
          field: "pending",
          operator: "lte",
          value: "5",
          min: "",
          max: "",
        },
      ],
      SHIFT_FULFILLMENT_METRICS,
    );
    expect(error).toContain("Only one filter per data point");
  });

  it("rejects fill rate greater-than operator", () => {
    const error = validateReportFilterRules(
      [
        {
          kind: "numeric",
          field: "fillRate",
          operator: "gt",
          value: "60",
          min: "",
          max: "",
        },
      ],
      SHIFT_FULFILLMENT_METRICS,
    );
    expect(error).toContain("does not support");
  });
});
