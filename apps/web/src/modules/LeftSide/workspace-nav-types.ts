import type {
  ApprovalPolicy,
  ThinkingLevel
} from "../agent-messages/agent-message-types";

export interface WorkspaceTaskSummary {
  activeAgentId?: string;
  approvalPolicy?: ApprovalPolicy;
  id: string;
  initialUserMessage: string;
  lastContinuedAt: string;
  lastModelId?: string | null;
  lastModelName: string;
  lastModelProvider: string;
  lastModelProviderSource: "built_in" | "custom";
  sourceMark?: string | null;
  sourceType?: "manual" | "scheduled";
  status: "running" | "completed" | "error";
  thinkingLevel?: ThinkingLevel;
  title: string;
}

export interface WorkspaceSummary {
  hasMore: boolean;
  id: string;
  name: string;
  path: string;
  tasks: WorkspaceTaskSummary[];
}

export interface WorkspaceNavigationResponse {
  workspaces: WorkspaceSummary[];
}

export interface WorkspaceSetting {
  activePlugins?: string[];
  activeSkills?: string[];
}

export interface WorkspaceSettingOption {
  id: string;
  name: string;
}

export interface WorkspaceSkillSettingOption extends WorkspaceSettingOption {
  path: string;
  source: "global" | "workspace";
}

export interface WorkspaceSettingResponse {
  pluginOptions: WorkspaceSettingOption[];
  setting: WorkspaceSetting;
  skillOptions: WorkspaceSkillSettingOption[];
  workspaceId: string;
}

export interface UpdateWorkspaceSettingRequest {
  activePlugins?: string[] | null;
  activeSkills?: string[] | null;
}

export interface UpdateWorkspaceSettingResponse {
  setting: WorkspaceSetting;
  workspaceId: string;
}

export interface WorkspaceTaskPageResponse {
  hasMore: boolean;
  tasks: WorkspaceTaskSummary[];
  workspaceId: string;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}
