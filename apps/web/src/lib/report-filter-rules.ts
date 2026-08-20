import type { CentreMetricFilterSearch } from "@/lib/report-centre-metric-filters";

export type NumericOperator = "eq" | "gt" | "gte" | "lt" | "lte" | "between";
export type EnumOperator = "is" | "in";

export type NumericReportFilterRule = {
  kind: "numeric";
  field: string;
  operator: NumericOperator;
  value: string;
  min: string;
  max: string;
};

export type EnumReportFilterRule = {
  kind: "enum";
  field: string;
  operator: EnumOperator;
  values: string[];
};

export type ReportFilterRule = NumericReportFilterRule | EnumReportFilterRule;

export type MetricValueKind = "integer" | "percent" | "hours" | "enum";

export type MetricFieldDef = {
  field: string;
  label: string;
  group: string;
  kind: MetricValueKind;
  minKey?: keyof CentreMetricFilterSearch | string;
  maxKey?: keyof CentreMetricFilterSearch | string;
  enumKey?: string;
  enumOptions?: ReadonlyArray<{ value: string; label: string }>;
};

export const NUMERIC_OPERATOR_LABELS: Record<NumericOperator, string> = {
  eq: "Is",
  gt: "Greater than",
  gte: "At least",
  lt: "Less than",
  lte: "At most",
  between: "Between",
};

export const ENUM_OPERATOR_LABELS: Record<EnumOperator, string> = {
  is: "Is",
  in: "Is any of",
};

const INTEGER_OPERATORS: NumericOperator[] = ["eq", "gt", "gte", "lt", "lte", "between"];
const DECIMAL_OPERATORS: NumericOperator[] = ["eq", "gte", "lte", "between"];

const SHIFT_METRIC_BASE: MetricFieldDef[] = [
  { field: "totalShifts", label: "Total Shifts", group: "Shifts", kind: "integer", minKey: "totalShiftsMin", maxKey: "totalShiftsMax" },
  { field: "pending", label: "Pending", group: "Shifts", kind: "integer", minKey: "pendingMin", maxKey: "pendingMax" },
  { field: "filled", label: "Filled", group: "Shifts", kind: "integer", minKey: "filledMin", maxKey: "filledMax" },
  { field: "completed", label: "Completed", group: "Shifts", kind: "integer", minKey: "completedMin", maxKey: "completedMax" },
  { field: "cancelled", label: "Cancelled", group: "Shifts", kind: "integer", minKey: "cancelledMin", maxKey: "cancelledMax" },
  { field: "fillRate", label: "Fill Rate", group: "Performance", kind: "percent", minKey: "fillRateMin", maxKey: "fillRateMax" },
];

export const SHIFT_FULFILLMENT_METRICS: MetricFieldDef[] = [...SHIFT_METRIC_BASE];

export const CENTRE_USAGE_METRICS: MetricFieldDef[] = [
  ...SHIFT_METRIC_BASE,
  {
    field: "scheduledHours",
    label: "Scheduled Hours",
    group: "Hours",
    kind: "hours",
    minKey: "scheduledHoursMin",
    maxKey: "scheduledHoursMax",
  },
  {
    field: "completedScheduledHours",
    label: "Scheduled Hours on Completed Shifts",
    group: "Hours",
    kind: "hours",
    minKey: "completedScheduledHoursMin",
    maxKey: "completedScheduledHoursMax",
  },
];

const STAFF_ROLE_OPTIONS = [
  { value: "ECA", label: "ECA" },
  { value: "ECE", label: "ECE" },
  { value: "Nanny", label: "Nanny" },
] as const;

const STAFF_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

export const STAFF_USAGE_METRICS: MetricFieldDef[] = [
  {
    field: "role",
    label: "Role",
    group: "Staff",
    kind: "enum",
    enumKey: "roles",
    enumOptions: STAFF_ROLE_OPTIONS,
  },
  {
    field: "staffStatus",
    label: "Staff Status",
    group: "Staff",
    kind: "enum",
    enumKey: "staffStatuses",
    enumOptions: STAFF_STATUS_OPTIONS,
  },
  {
    field: "completedShifts",
    label: "Completed Shifts",
    group: "Completed Usage",
    kind: "integer",
    minKey: "completedShiftsMin",
    maxKey: "completedShiftsMax",
  },
  {
    field: "completedScheduledHours",
    label: "Scheduled Hours on Completed Shifts",
    group: "Completed Usage",
    kind: "hours",
    minKey: "completedScheduledHoursMin",
    maxKey: "completedScheduledHoursMax",
  },
  {
    field: "filledShifts",
    label: "Filled Shifts",
    group: "Filled Usage",
    kind: "integer",
    minKey: "filledShiftsMin",
    maxKey: "filledShiftsMax",
  },
  {
    field: "filledScheduledHours",
    label: "Scheduled Hours on Filled Shifts",
    group: "Filled Usage",
    kind: "hours",
    minKey: "filledScheduledHoursMin",
    maxKey: "filledScheduledHoursMax",
  },
];

export function getMetricDef(metrics: MetricFieldDef[], field: string): MetricFieldDef | undefined {
  return metrics.find((metric) => metric.field === field);
}

export function allowedNumericOperators(kind: MetricValueKind): NumericOperator[] {
  if (kind === "integer") return INTEGER_OPERATORS;
  return DECIMAL_OPERATORS;
}

export function defaultNumericOperator(kind: MetricValueKind): NumericOperator {
  return kind === "integer" ? "gte" : "gte";
}

export function createNumericRule(field: string, kind: MetricValueKind): NumericReportFilterRule {
  return {
    kind: "numeric",
    field,
    operator: defaultNumericOperator(kind),
    value: "",
    min: "",
    max: "",
  };
}

export function createEnumRule(field: string): EnumReportFilterRule {
  return {
    kind: "enum",
    field,
    operator: "is",
    values: [],
  };
}

function parseInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

function parseDecimal(value: string, max = 100): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return undefined;
  return parsed;
}

function parseHours(value: string): number | undefined {
  return parseDecimal(value, Number.MAX_SAFE_INTEGER);
}

function minMaxStringsToNumericRule(
  field: string,
  kind: MetricValueKind,
  minRaw?: string,
  maxRaw?: string,
): NumericReportFilterRule | null {
  const min = minRaw?.trim() ?? "";
  const max = maxRaw?.trim() ?? "";
  if (!min && !max) return null;

  if (min && max) {
    if (min === max) {
      return { kind: "numeric", field, operator: "eq", value: min, min: "", max: "" };
    }
    return { kind: "numeric", field, operator: "between", value: "", min, max };
  }
  if (min) {
    return { kind: "numeric", field, operator: "gte", value: min, min: "", max: "" };
  }
  return { kind: "numeric", field, operator: "lte", value: max, min: "", max: "" };
}

export function rulesFromCentreMetricSearch(
  search: CentreMetricFilterSearch,
  metrics: MetricFieldDef[],
): ReportFilterRule[] {
  const rules: ReportFilterRule[] = [];
  for (const metric of metrics) {
    if (metric.kind === "enum" || !metric.minKey || !metric.maxKey) continue;
    const rule = minMaxStringsToNumericRule(
      metric.field,
      metric.kind,
      search[metric.minKey as keyof CentreMetricFilterSearch],
      search[metric.maxKey as keyof CentreMetricFilterSearch],
    );
    if (rule) rules.push(rule);
  }
  return rules;
}

export type StaffUsageMetricSearch = {
  roles: string[];
  staffStatuses: string[];
  completedShiftsMin: string;
  completedShiftsMax: string;
  completedScheduledHoursMin: string;
  completedScheduledHoursMax: string;
  filledShiftsMin: string;
  filledShiftsMax: string;
  filledScheduledHoursMin: string;
  filledScheduledHoursMax: string;
};

export function rulesFromStaffUsageSearch(search: StaffUsageMetricSearch): ReportFilterRule[] {
  const rules: ReportFilterRule[] = [];

  if (search.roles.length === 1) {
    rules.push({ kind: "enum", field: "role", operator: "is", values: [search.roles[0]] });
  } else if (search.roles.length > 1) {
    rules.push({ kind: "enum", field: "role", operator: "in", values: [...search.roles] });
  }

  if (search.staffStatuses.length === 1) {
    rules.push({
      kind: "enum",
      field: "staffStatus",
      operator: "is",
      values: [search.staffStatuses[0]],
    });
  } else if (search.staffStatuses.length > 1) {
    rules.push({
      kind: "enum",
      field: "staffStatus",
      operator: "in",
      values: [...search.staffStatuses],
    });
  }

  for (const metric of STAFF_USAGE_METRICS) {
    if (metric.kind === "enum" || !metric.minKey || !metric.maxKey) continue;
    const rule = minMaxStringsToNumericRule(
      metric.field,
      metric.kind,
      search[metric.minKey as keyof StaffUsageMetricSearch] as string | undefined,
      search[metric.maxKey as keyof StaffUsageMetricSearch] as string | undefined,
    );
    if (rule) rules.push(rule);
  }

  return rules;
}

function numericRuleToMinMax(
  rule: NumericReportFilterRule,
  kind: MetricValueKind,
): { min?: string; max?: string } {
  const value = rule.value.trim();
  const minVal = rule.min.trim();
  const maxVal = rule.max.trim();

  switch (rule.operator) {
    case "eq":
      return { min: value, max: value };
    case "gte":
      return { min: value, max: undefined };
    case "lte":
      return { min: undefined, max: value };
    case "gt": {
      const parsed = parseInteger(value);
      if (parsed === undefined) return {};
      return { min: String(parsed + 1), max: undefined };
    }
    case "lt": {
      const parsed = parseInteger(value);
      if (parsed === undefined || parsed === 0) return {};
      return { min: undefined, max: String(parsed - 1) };
    }
    case "between":
      return { min: minVal || undefined, max: maxVal || undefined };
    default:
      return {};
  }
}

export function centreMetricSearchFromRules(
  rules: ReportFilterRule[],
  metrics: MetricFieldDef[],
): CentreMetricFilterSearch {
  const next: CentreMetricFilterSearch = {
    totalShiftsMin: "",
    totalShiftsMax: "",
    fillRateMin: "",
    fillRateMax: "",
    pendingMin: "",
    pendingMax: "",
    filledMin: "",
    filledMax: "",
    completedMin: "",
    completedMax: "",
    cancelledMin: "",
    cancelledMax: "",
    scheduledHoursMin: "",
    scheduledHoursMax: "",
    completedScheduledHoursMin: "",
    completedScheduledHoursMax: "",
  };

  for (const rule of rules) {
    if (rule.kind !== "numeric") continue;
    const metric = getMetricDef(metrics, rule.field);
    if (!metric?.minKey || !metric.maxKey) continue;
    const { min, max } = numericRuleToMinMax(rule, metric.kind);
    if (min !== undefined) next[metric.minKey as keyof CentreMetricFilterSearch] = min;
    if (max !== undefined) next[metric.maxKey as keyof CentreMetricFilterSearch] = max;
  }

  return next;
}

export function staffUsageSearchFromRules(rules: ReportFilterRule[]): StaffUsageMetricSearch {
  const next: StaffUsageMetricSearch = {
    roles: [],
    staffStatuses: [],
    completedShiftsMin: "",
    completedShiftsMax: "",
    completedScheduledHoursMin: "",
    completedScheduledHoursMax: "",
    filledShiftsMin: "",
    filledShiftsMax: "",
    filledScheduledHoursMin: "",
    filledScheduledHoursMax: "",
  };

  for (const rule of rules) {
    if (rule.kind === "enum") {
      if (rule.field === "role" && rule.values.length) {
        next.roles = [...rule.values];
      }
      if (rule.field === "staffStatus" && rule.values.length) {
        next.staffStatuses = [...rule.values];
      }
      continue;
    }

    const metric = getMetricDef(STAFF_USAGE_METRICS, rule.field);
    if (!metric?.minKey || !metric.maxKey) continue;
    const { min, max } = numericRuleToMinMax(rule, metric.kind);
    if (min !== undefined) next[metric.minKey as keyof StaffUsageMetricSearch] = min;
    if (max !== undefined) next[metric.maxKey as keyof StaffUsageMetricSearch] = max;
  }

  return next;
}

export function formatRuleSummary(rule: ReportFilterRule, metrics: MetricFieldDef[]): string {
  const metric = getMetricDef(metrics, rule.field);
  const label = metric?.label ?? rule.field;

  if (rule.kind === "enum") {
    const valueLabels =
      rule.values
        .map(
          (value) =>
            metric?.enumOptions?.find((option) => option.value === value)?.label ?? value,
        )
        .join(", ") || "—";
    return `${label} ${ENUM_OPERATOR_LABELS[rule.operator]} ${valueLabels}`;
  }

  const suffix = metric?.kind === "percent" ? "%" : metric?.kind === "hours" ? "h" : "";
  switch (rule.operator) {
    case "eq":
      return `${label} ${NUMERIC_OPERATOR_LABELS.eq} ${rule.value}${suffix}`;
    case "gt":
      return `${label} > ${rule.value}${suffix}`;
    case "gte":
      return `${label} ≥ ${rule.value}${suffix}`;
    case "lt":
      return `${label} < ${rule.value}${suffix}`;
    case "lte":
      return `${label} ≤ ${rule.value}${suffix}`;
    case "between":
      return `${label} ${rule.min}${suffix}–${rule.max}${suffix}`;
    default:
      return label;
  }
}

export function validateReportFilterRules(
  rules: ReportFilterRule[],
  metrics: MetricFieldDef[],
): string | null {
  const seen = new Set<string>();

  for (const rule of rules) {
    if (seen.has(rule.field)) {
      return `Only one filter per data point is allowed (${getMetricDef(metrics, rule.field)?.label ?? rule.field}).`;
    }
    seen.add(rule.field);

    const metric = getMetricDef(metrics, rule.field);
    if (!metric) return "Unknown filter field.";

    if (rule.kind === "enum") {
      if (rule.values.length === 0) {
        return `${metric.label} requires at least one value.`;
      }
      for (const value of rule.values) {
        if (!metric.enumOptions?.some((option) => option.value === value)) {
          return `${metric.label} has an invalid value.`;
        }
      }
      continue;
    }

    if (!allowedNumericOperators(metric.kind).includes(rule.operator)) {
      return `${metric.label} does not support the selected condition.`;
    }

    const validateNumber = (value: string, fieldLabel: string) => {
      if (metric.kind === "integer") {
        if (parseInteger(value) === undefined) return `${fieldLabel} must be a whole number ≥ 0.`;
      } else if (metric.kind === "percent") {
        if (parseDecimal(value, 100) === undefined) return `${fieldLabel} must be between 0 and 100.`;
      } else if (parseHours(value) === undefined) {
        return `${fieldLabel} must be a number ≥ 0.`;
      }
      return null;
    };

    if (rule.operator === "between") {
      const minError = validateNumber(rule.min, `${metric.label} minimum`);
      if (minError) return minError;
      const maxError = validateNumber(rule.max, `${metric.label} maximum`);
      if (maxError) return maxError;
      const minNum =
        metric.kind === "integer" ? parseInteger(rule.min)! : Number(rule.min);
      const maxNum =
        metric.kind === "integer" ? parseInteger(rule.max)! : Number(rule.max);
      if (minNum > maxNum) {
        return `${metric.label} minimum must not be greater than maximum.`;
      }
      continue;
    }

    const valueError = validateNumber(rule.value, metric.label);
    if (valueError) return valueError;
  }

  return null;
}

export function staffUsageSearchToSearchParams(
  search: StaffUsageMetricSearch,
): Record<string, string | undefined> {
  return {
    roles: search.roles.length ? search.roles.join(",") : undefined,
    staffStatuses: search.staffStatuses.length ? search.staffStatuses.join(",") : undefined,
    completedShiftsMin: search.completedShiftsMin.trim() || undefined,
    completedShiftsMax: search.completedShiftsMax.trim() || undefined,
    completedScheduledHoursMin: search.completedScheduledHoursMin.trim() || undefined,
    completedScheduledHoursMax: search.completedScheduledHoursMax.trim() || undefined,
    filledShiftsMin: search.filledShiftsMin.trim() || undefined,
    filledShiftsMax: search.filledShiftsMax.trim() || undefined,
    filledScheduledHoursMin: search.filledScheduledHoursMin.trim() || undefined,
    filledScheduledHoursMax: search.filledScheduledHoursMax.trim() || undefined,
  };
}

export const EMPTY_STAFF_USAGE_METRIC_SEARCH: StaffUsageMetricSearch = {
  roles: [],
  staffStatuses: [],
  completedShiftsMin: "",
  completedShiftsMax: "",
  completedScheduledHoursMin: "",
  completedScheduledHoursMax: "",
  filledShiftsMin: "",
  filledShiftsMax: "",
  filledScheduledHoursMin: "",
  filledScheduledHoursMax: "",
};

export function staffUsageMetricSearchFromApplied(search: {
  roles?: string;
  staffStatuses?: string;
  completedShiftsMin?: string;
  completedShiftsMax?: string;
  completedScheduledHoursMin?: string;
  completedScheduledHoursMax?: string;
  filledShiftsMin?: string;
  filledShiftsMax?: string;
  filledScheduledHoursMin?: string;
  filledScheduledHoursMax?: string;
}): StaffUsageMetricSearch {
  return {
    roles: search.roles ? search.roles.split(",").filter(Boolean) : [],
    staffStatuses: search.staffStatuses ? search.staffStatuses.split(",").filter(Boolean) : [],
    completedShiftsMin: search.completedShiftsMin ?? "",
    completedShiftsMax: search.completedShiftsMax ?? "",
    completedScheduledHoursMin: search.completedScheduledHoursMin ?? "",
    completedScheduledHoursMax: search.completedScheduledHoursMax ?? "",
    filledShiftsMin: search.filledShiftsMin ?? "",
    filledShiftsMax: search.filledShiftsMax ?? "",
    filledScheduledHoursMin: search.filledScheduledHoursMin ?? "",
    filledScheduledHoursMax: search.filledScheduledHoursMax ?? "",
  };
}

export function groupedMetricOptions(metrics: MetricFieldDef[], activeFields: Set<string>) {
  const groups = new Map<string, MetricFieldDef[]>();
  for (const metric of metrics) {
    if (activeFields.has(metric.field)) continue;
    const list = groups.get(metric.group) ?? [];
    list.push(metric);
    groups.set(metric.group, list);
  }
  return [...groups.entries()];
}

