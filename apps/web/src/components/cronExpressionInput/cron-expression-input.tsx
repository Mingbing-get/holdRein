import { DownOutlined } from "@ant-design/icons";
import { Input, Popover } from "antd";
import { useEffect, useMemo, useState } from "react";
import cronstrue from "cronstrue/i18n";
import "cronstrue/locales/zh_CN";

import { createEmptyCronSelection, parseCronExpression } from "./cron-expression";
import { CronExpressionEditor } from "./cron-expression-editor";
import "./cron-expression-input.css";

export interface CronExpressionInputProps {
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  status?: "error" | "warning";
  id?: string;
}

export function CronExpressionInput({
  disabled = false,
  id,
  onBlur,
  onChange,
  status,
  value = ""
}: CronExpressionInputProps) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const parsed = useMemo(() => (value ? parseCronExpression(value) : null), [value]);
  const displayValue = useMemo(() => describeValue(value), [value]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function changeOpen(nextOpen: boolean): void {
    if (disabled) return;
    if (nextOpen) setSession((current) => current + 1);
    setOpen(nextOpen);
  }

  const content = open ? (
    <CronExpressionEditor
      initialSelection={parsed?.ok ? parsed.selection : createEmptyCronSelection()}
      initialValueInvalid={Boolean(value && parsed && !parsed.ok)}
      key={session}
      onCancel={() => setOpen(false)}
      onConfirm={(nextValue) => {
        onChange?.(nextValue);
        setOpen(false);
      }}
    />
  ) : null;

  return (
    <Popover
      content={content}
      destroyOnHidden
      onOpenChange={changeOpen}
      open={open}
      placement="bottomLeft"
      trigger="click"
    >
      <Input
        aria-label="执行周期"
        className="cron-expression-input"
        disabled={disabled}
        {...(id === undefined ? {} : { id })}
        {...(onBlur === undefined ? {} : { onBlur })}
        onClick={() => changeOpen(true)}
        placeholder="请选择执行周期"
        readOnly
        {...(status === undefined ? {} : { status })}
        suffix={<DownOutlined aria-hidden />}
        value={displayValue}
      />
    </Popover>
  );
}

function describeValue(value: string): string {
  if (!value) return "";
  const parsed = parseCronExpression(value);
  if (!parsed.ok) return "无法识别的执行周期";
  try {
    return cronstrue.toString(value, { locale: "zh_CN" });
  } catch {
    return "无法识别的执行周期";
  }
}
