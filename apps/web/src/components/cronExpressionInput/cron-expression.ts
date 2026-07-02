import type {
  CronField,
  CronFieldDefinition,
  CronFrequency,
  CronParseError,
  CronParseResult,
  CronSelection
} from "./cron-expression-types";

export const CRON_FIELD_DEFINITIONS: readonly CronFieldDefinition[] = [
  { field: "minute", label: "分钟", maximum: 59, minimum: 0 },
  { field: "hour", label: "小时", maximum: 23, minimum: 0 },
  { field: "dayOfMonth", label: "日期", maximum: 31, minimum: 1 },
  { field: "month", label: "月份", maximum: 12, minimum: 1 },
  { field: "dayOfWeek", label: "星期", maximum: 7, minimum: 1 }
] as const;

const VISIBLE_FIELDS: Record<CronFrequency, readonly CronField[]> = {
  day: ["dayOfMonth", "hour", "minute"],
  hour: ["hour", "minute"],
  minute: ["minute"],
  month: ["month", "dayOfMonth", "hour", "minute"],
  week: ["dayOfWeek", "hour", "minute"]
};

export function createEmptyCronSelection(
  frequency: CronFrequency = "minute"
): CronSelection {
  return {
    dayOfMonth: [],
    dayOfWeek: [],
    frequency,
    hour: [],
    minute: [],
    month: []
  };
}

export function getVisibleCronFields(
  frequency: CronFrequency
): readonly CronField[] {
  return VISIBLE_FIELDS[frequency];
}

export function parseCronExpression(expression: string): CronParseResult {
  const fragments = expression.trim().split(/\s+/);
  if (fragments.length !== CRON_FIELD_DEFINITIONS.length) {
    return failure("field-count");
  }

  const selection = createEmptyCronSelection();
  for (const [index, definition] of CRON_FIELD_DEFINITIONS.entries()) {
    const expanded = expandField(fragments[index] ?? "", definition);
    if ("code" in expanded) return { error: expanded, ok: false };
    selection[definition.field] = normalizeSelection(expanded, definition);
  }

  if (selection.dayOfMonth.length > 0 && selection.dayOfWeek.length > 0) {
    return failure("conflicting-day-fields");
  }
  selection.frequency = inferFrequency(selection);
  return { ok: true, selection };
}

export function serializeCronSelection(selection: CronSelection): string {
  const visible = new Set(getVisibleCronFields(selection.frequency));
  return CRON_FIELD_DEFINITIONS.map((definition) => {
    if (!visible.has(definition.field)) return "*";
    const values = normalizeSelection(selection[definition.field], definition);
    return values.length === 0 ? "*" : values.join(",");
  }).join(" ");
}

function expandField(
  source: string,
  definition: CronFieldDefinition
): number[] | CronParseError {
  if (source === "*") return [];
  if (source.length === 0) return fieldFailure("invalid-fragment", definition.field);
  const values = new Set<number>();
  for (const fragment of source.split(",")) {
    const expanded = expandFragment(fragment, definition);
    if ("code" in expanded) return expanded;
    expanded.forEach((value) => values.add(value));
  }
  return [...values].sort((left, right) => left - right);
}

function expandFragment(
  fragment: string,
  definition: CronFieldDefinition
): number[] | CronParseError {
  const parts = fragment.split("/");
  if (parts.length > 2 || !parts[0]) {
    return fieldFailure("invalid-fragment", definition.field);
  }
  const step = parts[1] === undefined ? 1 : parseInteger(parts[1]);
  if (step === null || step <= 0) {
    return fieldFailure("invalid-step", definition.field);
  }
  const base = parts[0];
  let start: number;
  let end: number;
  if (base === "*") {
    start = definition.minimum;
    end = definition.maximum;
  } else if (base.includes("-")) {
    const range = base.split("-");
    if (range.length !== 2) return fieldFailure("invalid-fragment", definition.field);
    const parsedStart = parseInteger(range[0] ?? "");
    const parsedEnd = parseInteger(range[1] ?? "");
    if (parsedStart === null || parsedEnd === null || parsedStart > parsedEnd) {
      return fieldFailure("invalid-fragment", definition.field);
    }
    start = parsedStart;
    end = parsedEnd;
  } else {
    const value = parseInteger(base);
    if (value === null) {
      return fieldFailure("invalid-fragment", definition.field);
    }
    start = value;
    end = parts[1] === undefined ? value : definition.maximum;
  }
  if (start < definition.minimum || end > definition.maximum) {
    return fieldFailure("out-of-range", definition.field);
  }
  const values: number[] = [];
  for (let value = start; value <= end; value += step) values.push(value);
  return values;
}

function inferFrequency(selection: CronSelection): CronFrequency {
  if (selection.month.length > 0) return "month";
  if (selection.dayOfWeek.length > 0) return "week";
  if (selection.dayOfMonth.length > 0) return "day";
  if (selection.hour.length > 0) return "hour";
  return "minute";
}

function normalizeSelection(
  values: readonly number[],
  definition: CronFieldDefinition
): number[] {
  const normalized = [...new Set(values)]
    .filter((value) => Number.isInteger(value))
    .sort((left, right) => left - right);
  const domainSize = definition.maximum - definition.minimum + 1;
  return normalized.length === domainSize ? [] : normalized;
}

function parseInteger(source: string): number | null {
  return /^\d+$/.test(source) ? Number(source) : null;
}

function failure(code: CronParseError["code"]): CronParseResult {
  return { error: { code }, ok: false };
}

function fieldFailure(
  code: CronParseError["code"],
  field: CronField
): CronParseError {
  return { code, field };
}
