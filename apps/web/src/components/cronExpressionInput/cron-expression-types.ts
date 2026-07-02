export type CronFrequency = "minute" | "hour" | "day" | "week" | "month";

export interface CronSelection {
  frequency: CronFrequency;
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

export type CronParseErrorCode =
  | "conflicting-day-fields"
  | "field-count"
  | "invalid-fragment"
  | "invalid-step"
  | "out-of-range";

export interface CronParseError {
  code: CronParseErrorCode;
  field?: CronField;
}

export type CronParseResult =
  | { ok: true; selection: CronSelection }
  | { error: CronParseError; ok: false };

export type CronField =
  | "minute"
  | "hour"
  | "dayOfMonth"
  | "month"
  | "dayOfWeek";

export interface CronFieldDefinition {
  field: CronField;
  label: string;
  maximum: number;
  minimum: number;
}
