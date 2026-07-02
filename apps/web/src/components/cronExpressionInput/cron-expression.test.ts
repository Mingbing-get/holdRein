import { describe, expect, it } from "vitest";

import { parseCronExpression, serializeCronSelection } from "./cron-expression";

describe("cron expression model", () => {
  it.each([
    ["* * * * *", "minute"],
    ["5 8 * * *", "hour"],
    ["5 8 12 * *", "day"],
    ["5 8 * * 1", "week"],
    ["5 8 12 3 *", "month"]
  ] as const)("infers %s as %s frequency", (expression, frequency) => {
    const result = parseCronExpression(expression);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.selection.frequency).toBe(frequency);
  });

  it("expands ranges, wildcard steps, bounded steps, and overlapping lists", () => {
    const result = parseCronExpression("*/15 8-12/2,10 * * *");
    expect(result).toEqual({
      ok: true,
      selection: {
        dayOfMonth: [],
        dayOfWeek: [],
        frequency: "hour",
        hour: [8, 10, 12],
        minute: [0, 15, 30, 45],
        month: []
      }
    });
  });

  it("expands a stepped value through the end of its field domain", () => {
    const result = parseCronExpression("5/20 * * * *");
    expect(result).toMatchObject({
      ok: true,
      selection: { minute: [5, 25, 45] }
    });
  });

  it("sorts, deduplicates, and serializes hidden fields as wildcards", () => {
    expect(
      serializeCronSelection({
        dayOfMonth: [20],
        dayOfWeek: [7, 1],
        frequency: "week",
        hour: [18, 8, 8],
        minute: [30, 0],
        month: [12]
      })
    ).toBe("0,30 8,18 * * 1,7");
  });

  it("normalizes a complete selection to a wildcard", () => {
    expect(
      serializeCronSelection({
        dayOfMonth: [],
        dayOfWeek: [],
        frequency: "minute",
        hour: [],
        minute: Array.from({ length: 60 }, (_, value) => value),
        month: []
      })
    ).toBe("* * * * *");
  });

  it.each([
    ["0 0 1 * 1", "conflicting-day-fields"],
    ["0 0 * *", "field-count"],
    ["0 0 * * * *", "field-count"],
    ["60 * * * *", "out-of-range"],
    ["*/0 * * * *", "invalid-step"],
    ["1--2 * * * *", "invalid-fragment"]
  ] as const)("rejects unsupported expression %s", (expression, code) => {
    const result = parseCronExpression(expression);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });
});
