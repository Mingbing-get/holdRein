import type { HostApiApprovalPolicy, HostApiThinkingLevel } from "../agent";
import type { HostApiRequest, HostApiResult } from "..";

export interface HostApiWorkspaceTaskSummary {
  readonly activeAgentId?: string;
  readonly approvalPolicy?: HostApiApprovalPolicy;
  readonly id: string;
  readonly initialUserMessage: string;
  readonly lastContinuedAt: string;
  readonly lastModelId?: string | null;
  readonly lastModelName: string;
  readonly lastModelProvider: string;
  readonly lastModelProviderSource: "built_in" | "custom";
  readonly sourceMark?: string | null;
  readonly sourceType?: "manual" | "scheduled";
  readonly status: "completed" | "error" | "running";
  readonly thinkingLevel?: HostApiThinkingLevel;
  readonly title: string;
}

export interface HostApiWorkspaceSummary {
  readonly hasMore: boolean;
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly tasks: readonly HostApiWorkspaceTaskSummary[];
}

export interface HostApiWorkspaceNavigationResult {
  readonly workspaces: readonly HostApiWorkspaceSummary[];
}

export interface HostApiWorkspaceIdInput {
  readonly workspaceId: string;
}

export interface HostApiDeletedWorkspaceResult {
  readonly workspaceId: string;
}

export interface HostApiWorkspaceSetting {
  readonly activePlugins?: readonly string[] | null;
  readonly activeSkills?: readonly string[] | null;
}

export interface HostApiWorkspaceSettingOption {
  readonly id: string;
  readonly name: string;
}

export interface HostApiWorkspaceSkillSettingOption
  extends HostApiWorkspaceSettingOption {
  readonly path: string;
  readonly source: "global" | "workspace";
}

export interface HostApiWorkspaceSettingResult {
  readonly pluginOptions: readonly HostApiWorkspaceSettingOption[];
  readonly setting: HostApiWorkspaceSetting;
  readonly skillOptions: readonly HostApiWorkspaceSkillSettingOption[];
  readonly workspaceId: string;
}

export interface HostApiUpdateWorkspaceSettingInput
  extends HostApiWorkspaceIdInput,
    HostApiWorkspaceSetting {}

export interface HostApiUpdateWorkspaceSettingResult {
  readonly setting: HostApiWorkspaceSetting;
  readonly workspaceId: string;
}

export interface HostApiListWorkspaceTasksInput extends HostApiWorkspaceIdInput {
  readonly afterLastContinuedAt?: string;
  readonly limit?: number;
}

export interface HostApiWorkspaceTaskPageResult {
  readonly hasMore: boolean;
  readonly tasks: readonly HostApiWorkspaceTaskSummary[];
  readonly workspaceId: string;
}

export interface HostApiWorkspacesClient {
  readonly delete: (
    input: HostApiWorkspaceIdInput
  ) => Promise<HostApiResult<HostApiDeletedWorkspaceResult>>;
  readonly getSetting: (
    input: HostApiWorkspaceIdInput
  ) => Promise<HostApiResult<HostApiWorkspaceSettingResult>>;
  readonly listRecentTasks: () => Promise<
    HostApiResult<HostApiWorkspaceNavigationResult>
  >;
  readonly listTasks: (
    input: HostApiListWorkspaceTasksInput
  ) => Promise<HostApiResult<HostApiWorkspaceTaskPageResult>>;
  readonly updateSetting: (
    input: HostApiUpdateWorkspaceSettingInput
  ) => Promise<HostApiResult<HostApiUpdateWorkspaceSettingResult>>;
}

export function createWorkspacesApi(
  request: HostApiRequest
): HostApiWorkspacesClient {
  return {
    delete(input) {
      return request<HostApiDeletedWorkspaceResult>({
        method: "DELETE",
        path: getWorkspacePath(input.workspaceId)
      });
    },
    getSetting(input) {
      return request<HostApiWorkspaceSettingResult>({
        path: `${getWorkspacePath(input.workspaceId)}/setting`
      });
    },
    listRecentTasks() {
      return request<HostApiWorkspaceNavigationResult>({
        path: "/api/v1/workspaces/recent-tasks"
      });
    },
    listTasks(input) {
      return request<HostApiWorkspaceTaskPageResult>({
        path: `${getWorkspacePath(input.workspaceId)}/tasks`,
        query: {
          afterLastContinuedAt: input.afterLastContinuedAt,
          limit: input.limit
        }
      });
    },
    updateSetting(input) {
      const { workspaceId, ...body } = input;

      return request<HostApiUpdateWorkspaceSettingResult>({
        body,
        method: "PATCH",
        path: `${getWorkspacePath(workspaceId)}/setting`
      });
    }
  };
}

function getWorkspacePath(workspaceId: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`;
}
