import { describe, expect, it } from "vitest";

import { describeCronExpression } from "./cron-description";

describe("describeCronExpression", () => {
  it.each([
    ["19 0 * * *", "在午夜 0:19"],
    ["59 5 * * *", "在午夜 05:59"],
    ["0 6 * * *", "在上午 06:00"],
    ["0 12 * * *", "在中午 12:00"],
    ["1 12 * * *", "在下午 12:01"],
    ["59 19 * * *", "在下午 07:59"],
    ["19 20 * * *", "在晚上 08:19"],
    ["59 23 * * *", "在晚上 11:59"]
  ])("describes %s with the expected Chinese period", (expression, expected) => {
    expect(describeCronExpression(expression)).toBe(expected);
  });

  it("normalizes every time in descriptions containing multiple hours", () => {
    expect(describeCronExpression("19 0,5,20,23 * * *")).toBe(
      "在 午夜 0:19, 午夜 05:19, 晚上 08:19 和 晚上 11:19"
    );
  });
});
