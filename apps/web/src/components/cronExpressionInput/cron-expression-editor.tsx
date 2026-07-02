import { Alert, Button, Segmented } from "antd";
import { useMemo, useState } from "react";
import cronstrue from "cronstrue/i18n";
import "cronstrue/locales/zh_CN";

import {
  CRON_FIELD_DEFINITIONS,
  getVisibleCronFields,
  serializeCronSelection
} from "./cron-expression";
import type {
  CronField,
  CronFrequency,
  CronSelection
} from "./cron-expression-types";
import { CronFieldSelector } from "./cron-field-selector";

interface CronExpressionEditorProps {
  initialSelection: CronSelection;
  initialValueInvalid: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

const FREQUENCY_OPTIONS: {
  label: string;
  value: CronFrequency;
}[] = [
  { label: "分钟", value: "minute" },
  { label: "小时", value: "hour" },
  { label: "天", value: "day" },
  { label: "周", value: "week" },
  { label: "月", value: "month" }
];

export function CronExpressionEditor({
  initialSelection,
  initialValueInvalid,
  onCancel,
  onConfirm
}: CronExpressionEditorProps) {
  const [selection, setSelection] = useState<CronSelection>(initialSelection);
  const [needsReplacement, setNeedsReplacement] = useState(initialValueInvalid);
  const expression = useMemo(() => serializeCronSelection(selection), [selection]);
  const description = useMemo(() => translate(expression), [expression]);
  const visibleFields = getVisibleCronFields(selection.frequency);

  function changeFrequency(frequency: CronFrequency): void {
    const visible = new Set(getVisibleCronFields(frequency));
    setSelection((current) => ({
      ...current,
      dayOfMonth: visible.has("dayOfMonth") ? current.dayOfMonth : [],
      dayOfWeek: visible.has("dayOfWeek") ? current.dayOfWeek : [],
      frequency,
      hour: visible.has("hour") ? current.hour : [],
      minute: visible.has("minute") ? current.minute : [],
      month: visible.has("month") ? current.month : []
    }));
    setNeedsReplacement(false);
  }

  function changeField(field: CronField, values: number[]): void {
    setSelection((current) => ({ ...current, [field]: values }));
  }

  return (
    <div className="cron-editor">
      <Segmented<CronFrequency>
        block
        onChange={changeFrequency}
        options={FREQUENCY_OPTIONS}
        value={selection.frequency}
      />
      {needsReplacement ? (
        <Alert
          description="请选择一个执行频率以替换当前值。"
          message="当前 Cron 表达式无法编辑"
          showIcon
          type="warning"
        />
      ) : null}
      <div className="cron-editor__fields">
        {visibleFields.map((field) => {
          const definition = CRON_FIELD_DEFINITIONS.find(
            (candidate) => candidate.field === field
          );
          if (!definition) return null;
          return (
            <CronFieldSelector
              field={field}
              key={field}
              label={definition.label}
              labels={createLabels(field, definition.minimum, definition.maximum)}
              minimum={definition.minimum}
              onChange={(values) => changeField(field, values)}
              values={selection[field]}
            />
          );
        })}
      </div>
      <footer className="cron-editor__footer">
        <div className="cron-editor__preview">
          <span>Cron 表达式</span>
          <code>{expression}</code>
          <span>{description}</span>
        </div>
        <div className="cron-editor__actions">
          <Button onClick={onCancel}>取消</Button>
          <Button
            disabled={needsReplacement}
            onClick={() => onConfirm(expression)}
            type="primary"
          >
            确定
          </Button>
        </div>
      </footer>
    </div>
  );
}

function createLabels(field: CronField, minimum: number, maximum: number): string[] {
  return Array.from({ length: maximum - minimum + 1 }, (_, index) => {
    const value = minimum + index;
    if (field === "minute" || field === "hour") return String(value).padStart(2, "0");
    if (field === "month") return `${value}月`;
    if (field === "dayOfWeek") return `周${"一二三四五六日"[index]}`;
    return String(value);
  });
}

function translate(expression: string): string {
  try {
    return cronstrue.toString(expression, { locale: "zh_CN" });
  } catch {
    return "无法识别的执行周期";
  }
}
