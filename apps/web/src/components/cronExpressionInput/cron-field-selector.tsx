import { Button } from "antd";

import type { CronField } from "./cron-expression-types";

interface CronFieldSelectorProps {
  field: CronField;
  label: string;
  labels: readonly string[];
  onChange: (values: number[]) => void;
  values: readonly number[];
  minimum: number;
}

export function CronFieldSelector({
  field,
  label,
  labels,
  minimum,
  onChange,
  values
}: CronFieldSelectorProps) {
  const selected = new Set(values);

  function toggle(value: number): void {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    const normalized = [...next].sort((left, right) => left - right);
    onChange(normalized.length === labels.length ? [] : normalized);
  }

  return (
    <section className="cron-field">
      <header className="cron-field__header">
        <span>{label}</span>
        <span className="cron-field__summary">
          {values.length === 0 ? "任意" : `已选 ${values.length} 项`}
        </span>
      </header>
      <div
        aria-label={`${label}选择`}
        className={`cron-field__grid cron-field__grid--${field}`}
        role="group"
      >
        {labels.map((itemLabel, index) => {
          const value = minimum + index;
          const pressed = selected.has(value);
          return (
            <Button
              aria-label={itemLabel}
              aria-pressed={pressed}
              className="cron-field__value"
              key={value}
              onClick={() => toggle(value)}
              size="small"
              type={pressed ? "primary" : "default"}
            >
              {itemLabel}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
