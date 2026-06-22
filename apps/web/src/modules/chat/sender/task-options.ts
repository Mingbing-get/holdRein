import type {
  ApprovalPolicy,
  ThinkingLevel
} from "../../agent-messages/agent-message-types";

export const DEFAULT_THINKING_LEVEL: ThinkingLevel = "medium";
export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = "approval";

export const THINKING_LEVEL_OPTIONS: {
  label: string;
  value: ThinkingLevel;
}[] = [
  { label: "关闭", value: "off" },
  { label: "极简", value: "minimal" },
  { label: "低", value: "low" },
  { label: "中", value: "medium" },
  { label: "高", value: "high" },
  { label: "超高", value: "xhigh" }
];

export const APPROVAL_POLICY_LABELS: Record<ApprovalPolicy, string> = {
  approval: "需审批",
  run_all: "跳过审批"
};

export function normalizeThinkingLevel(value: unknown): ThinkingLevel {
  return isThinkingLevel(value) ? value : DEFAULT_THINKING_LEVEL;
}

export function normalizeApprovalPolicy(value: unknown): ApprovalPolicy {
  return isApprovalPolicy(value) ? value : DEFAULT_APPROVAL_POLICY;
}

function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return THINKING_LEVEL_OPTIONS.some((option) => option.value === value);
}

function isApprovalPolicy(value: unknown): value is ApprovalPolicy {
  return value === "approval" || value === "run_all";
}
