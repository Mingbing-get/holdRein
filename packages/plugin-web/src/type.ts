import type { ComponentType, ReactNode } from "react";

export namespace WebPlugin {
  export type HttpMethod =
    | "DELETE"
    | "GET"
    | "PATCH"
    | "POST"
    | "PUT";

  export type RequestQueryValue =
    | boolean
    | number
    | string
    | undefined;

  export interface RequestOptions {
    readonly body?: BodyInit | null;
    readonly headers?: Record<string, string>;
    readonly method?: HttpMethod;
    readonly path: string;
    readonly query?: Readonly<Record<string, RequestQueryValue>>;
  }

  export interface Result<TData> {
    code: number;
    data: TData;
    msg: string;
  }

  export type ThemeMode = "light" | "dark";
  export type MainContentView = "chat" | "modelProviders" | (string & {});
  export type SidebarView = "workspace" | "settings";

  export interface AppUiState {
    activeMainView: MainContentView;
    activeSidebarView: SidebarView;
    rightSidebarCollapsed: boolean;
    rightSidebarResizing: boolean;
    rightSidebarWidth: number;
    sidebarCollapsed: boolean;
    sidebarResizing: boolean;
    sidebarWidth: number;
    themeMode: ThemeMode;
  }

  export interface AppUiContextValue {
    openSettingsNavigation: () => void;
    openWorkspaceNavigation: () => void;
    state: AppUiState; 
    setActiveMainView: (view: MainContentView) => void;
    setActiveSidebarView: (view: SidebarView) => void;
    setRightSidebarResizing: (rightSidebarResizing: boolean) => void;
    setRightSidebarWidth: (rightSidebarWidth: number) => void;
    setSidebarResizing: (sidebarResizing: boolean) => void;
    setSidebarWidth: (sidebarWidth: number) => void;
    toggleRightSidebar: () => void;
    toggleSidebar: () => void;
    toggleThemeMode: () => void;
  }

  export interface RuntimeContext {
    readonly appUi: AppUiContextValue;
    readonly request: <TData>(
      options: RequestOptions
    ) => Promise<Result<TData>>;
  }

  export interface TextContent {
    text: string;
    textSignature?: string;
    type: "text";
  }

  export interface ImageContent {
    data: string;
    mimeType: string;
    type: "image";
  }

  export interface ThinkingContent {
    redacted?: boolean;
    thinking: string;
    thinkingSignature?: string;
    type: "thinking";
  }

  export interface ToolCall {
    arguments: Record<string, unknown>;
    id: string;
    name: string;
    thoughtSignature?: string;
    type: "toolCall";
  }

  export interface AgentMessageBase {
    id: string;
    timestamp: number;
  }

  export interface UserMessage extends AgentMessageBase {
    content: string | (TextContent | ImageContent)[];
    role: "user";
  }

  export interface AssistantMessage extends AgentMessageBase {
    api: string;
    content: (TextContent | ThinkingContent | ToolCall)[];
    errorMessage?: string;
    model: string;
    provider: string;
    role: "assistant";
    stopReason: "stop" | "length" | "toolUse" | "error" | "aborted";
  }

  export interface ToolResultMessage extends AgentMessageBase {
    content: (TextContent | ImageContent)[];
    isError: boolean;
    role: "toolResult";
    toolCallId: string;
    toolName: string;
  }

  export interface CustomMessage extends AgentMessageBase {
    content: string | (TextContent | ImageContent)[];
    customType: string;
    display: boolean;
    role: "custom";
  }

  export interface BashExecutionMessage extends AgentMessageBase {
    cancelled: boolean;
    command: string;
    exitCode?: number;
    output: string;
    role: "bashExecution";
    truncated: boolean;
  }

  export interface SummaryMessage extends AgentMessageBase {
    role: "branchSummary" | "compactionSummary";
    summary: string;
  }

  export type AgentMessage =
    | UserMessage
    | AssistantMessage
    | ToolResultMessage
    | CustomMessage
    | BashExecutionMessage
    | SummaryMessage;

  export interface DefaultToolRenderProps {
    icon?: React.ReactNode,
    title: string,
    children: React.ReactNode
  }

  export interface ToolRenderProps {
    readonly result?: ToolResultMessage;
    readonly toolCall: ToolCall;
    readonly renderDefaultChildren: () => React.ReactNode;
    readonly DefaultToolRender: ComponentType<DefaultToolRenderProps>;
  }

  export interface ToolRender {
    readonly Render: ComponentType<ToolRenderProps>;
    readonly toolName: string;
  }

  export type SettingsPanelProps = Readonly<Record<string, never>>;

  export interface SettingsItem {
    readonly Render: ComponentType<SettingsPanelProps>;
    readonly icon?: ReactNode;
    readonly id: string;
    readonly title: string;
  }

  export interface RightPanelProps {
    messages: AgentMessage[];
    status: "idle" | "running" | "completed" | "error";
    taskId?: string;
    activeAgent?: {
      modelId: string;
      providerId: string;
    } | null;
    activeWorkspaceId?: string
  };

  export interface RightPanel {
    readonly Render: ComponentType<RightPanelProps>;
    readonly icon: ReactNode;
    readonly id: string;
    readonly title: string;
  }

  export interface SenderActionProps {
    draftMessage: string
    changeMessage: (message: string) => void
    insertText: (insertedText: string, overwriteLength?: number | undefined) => void
  };

  export interface SenderAction {
    readonly Render: ComponentType<SenderActionProps>;
    readonly id: string;
  }

  export interface SuggestionItem {
    children?: SuggestionItem[];
    extra?: React.ReactNode;
    icon?: React.ReactNode;
    label: string;
    value: string;
  }

  export interface SuggestionGroup {
    suggestions: SuggestionItem[];
    trigger: string;
  }

  export interface Contribution {
    readonly rightPanels?: readonly RightPanel[];
    readonly senderActions?: readonly SenderAction[];
    readonly senderSuggestions?: readonly SuggestionGroup[];
    readonly settings?: readonly SettingsItem[];
    readonly toolRenders?: readonly ToolRender[];
  }

  export type ContributionResolver =
    | Contribution
    | ((context: RuntimeContext) => Contribution | Promise<Contribution>);

  export interface Plugin {
    readonly contributionResolver?: ContributionResolver;
    readonly id: string;
  }
}
