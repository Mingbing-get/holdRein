import cronstrue from "cronstrue/i18n";
import "cronstrue/locales/zh_CN";

const CHINESE_TIME_PATTERN = /(上午|下午) (\d{1,2}):(\d{2})/g;

export function describeCronExpression(expression: string): string {
  return cronstrue
    .toString(expression, { locale: "zh_CN" })
    .replace(CHINESE_TIME_PATTERN, normalizeChineseTime);
}

function normalizeChineseTime(
  time: string,
  period: string,
  hourText: string,
  minuteText: string
): string {
  const hour = Number(hourText);

  if (period === "上午") {
    if (hour === 12) return `午夜 0:${minuteText}`;
    if (hour <= 5) return `午夜 ${hourText}:${minuteText}`;
  }

  if (period === "下午" && hour === 12 && minuteText === "00") {
    return "中午 12:00";
  }

  if (period === "下午" && hour >= 8 && hour <= 11) {
    return `晚上 ${hourText.padStart(2, "0")}:${minuteText}`;
  }

  return time;
}
