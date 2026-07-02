import { CronExpressionParser } from "cron-parser";
import cron from "node-cron";

export function isValidCronExpression(expression: string): boolean {
  return cron.validate(expression);
}

export function getNextRunAt(input: {
  expression: string;
  now: Date;
  timezone: string;
}): string {
  try {
    return CronExpressionParser.parse(input.expression, {
      currentDate: input.now,
      tz: input.timezone
    })
      .next()
      .toDate()
      .toISOString();
  } catch {
    throw new Error("Invalid cron expression");
  }
}
