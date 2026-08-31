import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  allowedNumericOperators,
  createEnumRule,
  createNumericRule,
  ENUM_OPERATOR_LABELS,
  NUMERIC_OPERATOR_LABELS,
  type EnumReportFilterRule,
  type MetricFieldDef,
  type NumericOperator,
  type NumericReportFilterRule,
  type ReportFilterRule,
} from "@/lib/report-filter-rules";
import { cn } from "@/lib/utils";

type ReportFilterRuleBuilderProps = {
  idPrefix: string;
  metrics: MetricFieldDef[];
  rules: ReportFilterRule[];
  onRulesChange: (rules: ReportFilterRule[]) => void;
  onClearRules?: () => void;
};

type ReportAddFilterButtonProps = {
  idPrefix: string;
  metrics: MetricFieldDef[];
  activeFields: Set<string>;
  onAdd: (field: string) => void;
};

export function ReportAddFilterButton({
  idPrefix,
  metrics,
  activeFields,
  onAdd,
}: ReportAddFilterButtonProps) {
  const [open, setOpen] = useState(false);
  const available = useMemo(
    () => metrics.filter((metric) => !activeFields.has(metric.field)),
    [metrics, activeFields],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          aria-label="Add filter"
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add filter
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        {available.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">All filters are already active.</p>
        ) : (
          <ul>
            {available.map((metric) => (
              <li key={metric.field}>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60"
                  onClick={() => {
                    onAdd(metric.field);
                    setOpen(false);
                  }}
                >
                  {metric.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NumericRuleRow({
  idPrefix,
  rule,
  metric,
  onChange,
  onRemove,
}: {
  idPrefix: string;
  rule: NumericReportFilterRule;
  metric: MetricFieldDef;
  onChange: (rule: NumericReportFilterRule) => void;
  onRemove: () => void;
}) {
  const operators = allowedNumericOperators(metric.kind);
  const showBetween = rule.operator === "between";
  const suffix = metric.kind === "percent" ? "%" : metric.kind === "hours" ? "h" : "";

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Data point</Label>
          <p className="text-sm font-medium">{metric.label}</p>
        </div>

        <div className="space-y-1 lg:w-40">
          <Label htmlFor={`${idPrefix}-${rule.field}-operator`} className="text-xs text-muted-foreground">
            Condition
          </Label>
          <Select
            value={rule.operator}
            onValueChange={(value) =>
              onChange({ ...rule, operator: value as NumericOperator })
            }
          >
            <SelectTrigger id={`${idPrefix}-${rule.field}-operator`} className="h-9" aria-label={`${metric.label} condition`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map((operator) => (
                <SelectItem key={operator} value={operator}>
                  {NUMERIC_OPERATOR_LABELS[operator]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showBetween ? (
          <>
            <div className="space-y-1 lg:w-28">
              <Label htmlFor={`${idPrefix}-${rule.field}-min`} className="text-xs text-muted-foreground">
                From{suffix ? ` (${suffix.trim()})` : ""}
              </Label>
              <Input
                id={`${idPrefix}-${rule.field}-min`}
                type="text"
                inputMode={metric.kind === "integer" ? "numeric" : "decimal"}
                value={rule.min}
                onChange={(event) => onChange({ ...rule, min: event.target.value })}
                className="h-9"
                aria-label={`${metric.label} minimum`}
              />
            </div>
            <div className="space-y-1 lg:w-28">
              <Label htmlFor={`${idPrefix}-${rule.field}-max`} className="text-xs text-muted-foreground">
                To{suffix ? ` (${suffix.trim()})` : ""}
              </Label>
              <Input
                id={`${idPrefix}-${rule.field}-max`}
                type="text"
                inputMode={metric.kind === "integer" ? "numeric" : "decimal"}
                value={rule.max}
                onChange={(event) => onChange({ ...rule, max: event.target.value })}
                className="h-9"
                aria-label={`${metric.label} maximum`}
              />
            </div>
          </>
        ) : (
          <div className="space-y-1 lg:w-28">
            <Label htmlFor={`${idPrefix}-${rule.field}-value`} className="text-xs text-muted-foreground">
              Value{suffix ? ` (${suffix.trim()})` : ""}
            </Label>
            <Input
              id={`${idPrefix}-${rule.field}-value`}
              type="text"
              inputMode={metric.kind === "integer" ? "numeric" : "decimal"}
              value={rule.value}
              onChange={(event) => onChange({ ...rule, value: event.target.value })}
              className="h-9"
              aria-label={`${metric.label} value`}
            />
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 self-end"
          aria-label={`Remove ${metric.label} filter`}
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EnumRuleRow({
  idPrefix,
  rule,
  metric,
  onChange,
  onRemove,
}: {
  idPrefix: string;
  rule: EnumReportFilterRule;
  metric: MetricFieldDef;
  onChange: (rule: EnumReportFilterRule) => void;
  onRemove: () => void;
}) {
  const options = metric.enumOptions ?? [];
  const multi = rule.operator === "in";

  function toggleValue(value: string, checked: boolean) {
    const next = checked
      ? [...new Set([...rule.values, value])]
      : rule.values.filter((item) => item !== value);
    onChange({ ...rule, values: next, operator: next.length > 1 ? "in" : "is" });
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Data point</Label>
          <p className="text-sm font-medium">{metric.label}</p>
        </div>

        <div className="space-y-1 lg:w-40">
          <Label htmlFor={`${idPrefix}-${rule.field}-operator`} className="text-xs text-muted-foreground">
            Condition
          </Label>
          <Select
            value={rule.operator}
            onValueChange={(value) =>
              onChange({
                ...rule,
                operator: value as EnumReportFilterRule["operator"],
                values: value === "is" && rule.values.length > 1 ? [rule.values[0]] : rule.values,
              })
            }
          >
            <SelectTrigger id={`${idPrefix}-${rule.field}-operator`} className="h-9" aria-label={`${metric.label} condition`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="is">{ENUM_OPERATOR_LABELS.is}</SelectItem>
              <SelectItem value="in">{ENUM_OPERATOR_LABELS.in}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <fieldset className="min-w-0 flex-1 space-y-2">
          <legend className="text-xs text-muted-foreground">{metric.label} values</legend>
          {multi ? (
            <div className="flex flex-wrap gap-3">
              {options.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={rule.values.includes(option.value)}
                    onCheckedChange={(checked) => toggleValue(option.value, checked === true)}
                    aria-label={`${metric.label}: ${option.label}`}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          ) : (
            <Select
              value={rule.values[0] ?? ""}
              onValueChange={(value) => onChange({ ...rule, values: [value], operator: "is" })}
            >
              <SelectTrigger className="h-9" aria-label={`${metric.label} value`}>
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </fieldset>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 self-end"
          aria-label={`Remove ${metric.label} filter`}
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ReportActiveFilterRules({
  idPrefix,
  metrics,
  rules,
  onRulesChange,
}: {
  idPrefix: string;
  metrics: MetricFieldDef[];
  rules: ReportFilterRule[];
  onRulesChange: (rules: ReportFilterRule[]) => void;
}) {
  function updateRule(index: number, nextRule: ReportFilterRule) {
    const next = [...rules];
    next[index] = nextRule;
    onRulesChange(next);
  }

  function removeRule(index: number) {
    onRulesChange(rules.filter((_, ruleIndex) => ruleIndex !== index));
  }

  if (rules.length === 0) return null;

  return (
    <div className="space-y-2">
      {rules.map((rule, index) => {
        const metric = metrics.find((item) => item.field === rule.field);
        if (!metric) return null;
        if (rule.kind === "enum") {
          return (
            <EnumRuleRow
              key={rule.field}
              idPrefix={idPrefix}
              rule={rule}
              metric={metric}
              onChange={(next) => updateRule(index, next)}
              onRemove={() => removeRule(index)}
            />
          );
        }
        return (
          <NumericRuleRow
            key={rule.field}
            idPrefix={idPrefix}
            rule={rule}
            metric={metric}
            onChange={(next) => updateRule(index, next)}
            onRemove={() => removeRule(index)}
          />
        );
      })}
    </div>
  );
}

export function ReportFilterRuleBuilder({
  idPrefix,
  metrics,
  rules,
  onRulesChange,
  onClearRules,
  onReset,
  onApply,
  applyDisabled,
}: ReportFilterRuleBuilderProps & {
  onReset?: () => void;
  onApply?: () => void;
  applyDisabled?: boolean;
}) {
  const activeFields = useMemo(() => new Set(rules.map((rule) => rule.field)), [rules]);

  function addRule(field: string) {
    const metric = metrics.find((item) => item.field === field);
    if (!metric || activeFields.has(field)) return;
    const nextRule =
      metric.kind === "enum" ? createEnumRule(field) : createNumericRule(field, metric.kind);
    onRulesChange([...rules, nextRule]);
  }

  return (
    <div className={cn("space-y-3 border-t border-border/70 pt-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ReportAddFilterButton
            idPrefix={idPrefix}
            metrics={metrics}
            activeFields={activeFields}
            onAdd={addRule}
          />
          {rules.length > 0 && onClearRules ? (
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onClearRules}>
              Clear filters
            </Button>
          ) : null}
        </div>
        {onReset && onApply ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={onReset}>
              Reset
            </Button>
            <Button size="sm" type="button" onClick={onApply} disabled={applyDisabled}>
              Apply
            </Button>
          </div>
        ) : null}
      </div>

      <ReportActiveFilterRules
        idPrefix={idPrefix}
        metrics={metrics}
        rules={rules}
        onRulesChange={onRulesChange}
      />
    </div>
  );
}
