import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useId, useState } from "react";

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
  const [collapsed, setCollapsed] = useState(false);
  const gridId = useId();
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
      <button
        aria-controls={gridId}
        aria-expanded={!collapsed}
        aria-label={`${label}折叠开关`}
        className="cron-field__header"
        onClick={() => setCollapsed((current) => !current)}
        type="button"
      >
        <span className="cron-field__title">
          {label}
          {collapsed ? <CaretRightOutlined aria-hidden /> : <CaretDownOutlined aria-hidden />}
        </span>
        <span className="cron-field__summary">
          {values.length === 0 ? "任意" : `已选 ${values.length} 项`}
        </span>
      </button>
      {collapsed ? null : (
        <div
          aria-label={`${label}选择`}
          className={`cron-field__grid cron-field__grid--${field}`}
          id={gridId}
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
      )}
    </section>
  );
}
