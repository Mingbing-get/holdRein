import { describe, expect, it } from "vitest";

import {
  APPROVAL_POLICY_LABELS,
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_THINKING_LEVEL,
  THINKING_LEVEL_OPTIONS,
  normalizeApprovalPolicy,
  normalizeThinkingLevel
} from "./task-options";

describe("sender task options", () => {
  it("defaults to medium thinking and explicit approval", () => {
    expect(DEFAULT_THINKING_LEVEL).toBe("medium");
    expect(DEFAULT_APPROVAL_POLICY).toBe("approval");
  });

  it("displays thinking levels in Chinese", () => {
    expect(THINKING_LEVEL_OPTIONS).toEqual([
      { label: "关闭", value: "off" },
      { label: "极简", value: "minimal" },
      { label: "低", value: "low" },
      { label: "中", value: "medium" },
      { label: "高", value: "high" },
      { label: "超高", value: "xhigh" }
    ]);
  });

  it("displays approval policy labels in Chinese", () => {
    expect(APPROVAL_POLICY_LABELS).toEqual({
      approval: "需审批",
      run_all: "跳过审批"
    });
  });

  it("normalizes unknown values to defaults", () => {
    expect(normalizeThinkingLevel("high")).toBe("high");
    expect(normalizeThinkingLevel("unknown")).toBe("medium");
    expect(normalizeApprovalPolicy("run_all")).toBe("run_all");
    expect(normalizeApprovalPolicy("unknown")).toBe("approval");
  });
});
