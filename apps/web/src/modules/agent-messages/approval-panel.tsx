import { App, Button, Flex, Input, Typography } from "antd";
import { useState } from "react";

import type { PendingApproval } from "./agent-message-types";

export interface ApprovalPanelProps {
  approval: PendingApproval;
  onDecide: (approved: boolean, reason?: string) => Promise<void>;
}

export function ApprovalPanel({ approval, onDecide }: ApprovalPanelProps) {
  const { message } = App.useApp();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (approved: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const rejectionReason = reason.trim();
      await onDecide(
        approved,
        approved || !rejectionReason ? undefined : rejectionReason
      );
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : "提交审批决定失败"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex
      data-testid="approval-panel"
      gap={8}
      vertical
      style={{
        background: "var(--app-color-bg-elevated)",
        border: "1px solid var(--app-color-border)",
        borderRadius: 8,
        boxShadow: "0 8px 24px var(--app-color-shadow)",
        padding: 12
      }}
    >
      <Typography.Text strong>待审批命令</Typography.Text>
      <Typography.Text code>{approval.command}</Typography.Text>
      <Button
        block
        disabled={submitting}
        loading={submitting}
        onClick={() => void submit(true)}
        type="primary"
      >
        同意
      </Button>
      <Button
        block
        danger
        disabled={submitting}
        onClick={() => void submit(false)}
      >
        拒绝
      </Button>
      <Input.TextArea
        aria-label="拒绝原因"
        disabled={submitting}
        onChange={(event) => setReason(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          void submit(false);
        }}
        placeholder="可选：输入拒绝原因，按 Enter 直接拒绝"
        value={reason}
      />
    </Flex>
  );
}
