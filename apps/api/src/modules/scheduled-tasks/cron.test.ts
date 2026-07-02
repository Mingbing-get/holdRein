import { describe, expect, it } from "vitest";

import { getNextRunAt, isValidCronExpression } from "./cron";

describe("scheduled task cron helpers", () => {
  it("validates cron expressions", () => {
    expect(isValidCronExpression("*/5 * * * *")).toBe(true);
    expect(isValidCronExpression("not cron")).toBe(false);
  });

  it("calculates the next run timestamp", () => {
    expect(
      getNextRunAt({
        expression: "*/5 * * * *",
        now: new Date("2026-07-02T00:01:00.000Z"),
        timezone: "Asia/Shanghai"
      })
    ).toBe("2026-07-02T00:05:00.000Z");
  });

  it("throws for invalid cron expressions", () => {
    expect(() =>
      getNextRunAt({
        expression: "not cron",
        now: new Date("2026-07-02T00:01:00.000Z"),
        timezone: "Asia/Shanghai"
      })
    ).toThrow("Invalid cron expression");
  });
});
