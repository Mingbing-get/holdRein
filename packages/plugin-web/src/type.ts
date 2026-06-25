import type { ComponentType, ReactNode } from "react";
import type { TSchema } from "typebox";

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
    rightActiveView: string;
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
    setRightActiveView: (view: string) => void;
    setRightSidebarResizing: (rightSidebarResizing: boolean) => void;
    setRightSidebarWidth: (rightSidebarWidth: number) => void;
    setSidebarResizing: (sidebarResizing: boolean) => void;
    setSidebarWidth: (sidebarWidth: number) => void;
    toggleRightSidebar: () => void;
    toggleSidebar: () => void;
    toggleThemeMode: () => void;
  }

  export interface RuntimeContext {
    readonly request: <TData>(
      options: RequestOptions
    ) => Promise<Result<TData>>;
    readonly subscribeAppUi: (callback: AppUiSubscriber) => () => void;
  }

  export type AppUiSubscriber = (appUi: AppUiContextValue) => void;

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
    argumentsParsed?: boolean;
    argumentsText?: string;
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
    details?: unknown;
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
    defaultExpanded?: boolean,
    title: string,
    children: React.ReactNode
  }

  export interface ToolRenderProps {
    readonly result?: ToolResultMessage;
    readonly toolCall: ToolCall;
    readonly renderDefaultChildren: () => React.ReactNode;
    readonly DefaultToolRender: ComponentType<DefaultToolRenderProps>;
    readonly workspacePath?: string | undefined;
  }

  export interface ToolRender {
    readonly Render: ComponentType<ToolRenderProps>;
    readonly toolName: string;
  }

  export interface BrowserToolExecutionContext {
    readonly agentId: string;
    readonly arguments: Record<string, unknown>;
    readonly taskId: string;
    readonly toolCallId: string;
    readonly toolName: string;
  }

  export type BrowserToolExecutor = (
    context: BrowserToolExecutionContext
  ) =>
    | Promise<string | TextContent[]>
    | string
    | TextContent[];

  export type BrowserToolBeforeExecuteResult =
    | {
        readonly block: true;
        readonly reason?: string;
      }
    | undefined;

  export type BrowserToolApprovalRequester = (
    title?: string
  ) => Promise<BrowserToolBeforeExecuteResult>;

  export interface BrowserToolBeforeExecuteOptions
    extends BrowserToolExecutionContext {
    readonly requestApproval: BrowserToolApprovalRequester;
  }

  export interface BrowserToolExecutionOptions
    extends BrowserToolExecutionContext {
    readonly requestApproval?: BrowserToolApprovalRequester;
  }

  export type BrowserToolBeforeExecute = (
    options: BrowserToolBeforeExecuteOptions
  ) =>
    | BrowserToolBeforeExecuteResult
    | Promise<BrowserToolBeforeExecuteResult>;

  export interface BrowserRuntimeTool<TParams extends TSchema = TSchema> {
    readonly beforeExecute?: BrowserToolBeforeExecute;
    readonly description?: string;
    readonly executor: BrowserToolExecutor;
    readonly name: string;
    readonly params: TParams;
  }

  export interface BrowserRuntimeToolSchema {
    readonly description?: string;
    readonly inputSchema: TSchema;
    readonly name: string;
  }

  export interface BrowserRuntimeSkill {
    readonly content: string;
    readonly description?: string;
    readonly name: string;
  }

  export interface BrowserRuntimeContributions {
    readonly skills?: readonly BrowserRuntimeSkill[];
    readonly systemPrompts?: readonly string[];
    readonly tools?: readonly BrowserRuntimeToolSchema[];
  }

  export interface ResolvedBrowserRuntimeContributions {
    readonly skills: readonly BrowserRuntimeSkill[];
    readonly systemPrompts: readonly string[];
    readonly tools: readonly BrowserRuntimeToolSchema[];
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
    workspacePath?: string | undefined;
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
    workspacePath?: string | undefined;
  };

  export interface SenderAction {
    readonly Render: ComponentType<SenderActionProps>;
    readonly id: string;
  }

  export interface TurnFooterRenderProps {
    messages: AgentMessage[];
    workspacePath?: string | undefined;
  }

  export interface TurnFooterRender {
    readonly Render: ComponentType<TurnFooterRenderProps>;
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
    title?: string;
    trigger: string;
  }

  export interface Contribution {
    readonly rightPanels?: readonly RightPanel[];
    readonly senderActions?: readonly SenderAction[];
    readonly senderSuggestions?: readonly SuggestionGroup[];
    readonly settings?: readonly SettingsItem[];
    readonly skills?: readonly BrowserRuntimeSkill[];
    readonly systemPrompts?: readonly string[];
    readonly toolRenders?: readonly ToolRender[];
    readonly tools?: readonly BrowserRuntimeTool[];
    readonly turnFooterRenders?: readonly TurnFooterRender[];
  }

  export type ContributionResolver =
    | Contribution
    | ((context: RuntimeContext) => Contribution | Promise<Contribution>);

  export interface Plugin {
    readonly contributionResolver?: ContributionResolver;
    readonly id: string;
  }
}
