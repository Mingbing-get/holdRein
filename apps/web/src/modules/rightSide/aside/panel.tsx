import { FileOutlined } from "@ant-design/icons";
import { Popover } from "antd";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { Fragment } from "react";
import { useEffect, useMemo, useState } from "react";

import { useAppUi } from "../../../app/app-ui-context";
import { useAppPlugins } from "../../../app/app-plugin";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import { useAgentMessages, useAgentTasks } from "../../agent-messages";
import { WorkspaceFileTree } from "../file-tree";

export default function RightPanel() {
  const { rightPanels } = useAppPlugins();
  const {
    setRightActiveView,
    state: { rightActiveView }
  } = useAppUi();
  const {
    state: { activeAgent, activeTaskId, activeWorkspaceId, workspaces },
  } = useAppWorkspace();
  const { getTaskState } = useAgentTasks();
  const [hoveredPanelId, setHoveredPanelId] = useState<string>("");

  const taskState = getTaskState(activeTaskId);
  const messages = useAgentMessages(activeTaskId);
  const builtinPanels = useMemo<WebPlugin.RightPanel[]>(
    () => [
      {
        Render: WorkspaceFileTree,
        icon: <FileOutlined aria-hidden="true" />,
        id: "workspace-files",
        title: "查看文件"
      }
    ],
    []
  );
  const panels = useMemo(
    () => [...builtinPanels, ...rightPanels],
    [builtinPanels, rightPanels]
  );
  const firstPanelId = panels[0]?.id ?? "";

  useEffect(() => {
    if (!panels.length) {
      setRightActiveView("");
      return;
    }

    if (!panels.some((panel) => panel.id === rightActiveView)) {
      setRightActiveView(firstPanelId);
    }
  }, [firstPanelId, panels, rightActiveView, setRightActiveView]);

  const panelProps = useMemo<WebPlugin.RightPanelProps>(
    () => ({
      activeAgent,
      messages,
      status: taskState?.status ?? "idle",
      ...(activeTaskId ? { taskId: activeTaskId } : {}),
      ...(activeWorkspaceId ? { activeWorkspaceId } : {}),
      workspacePath: workspaces.find(
        (workspace) => workspace.id === activeWorkspaceId
      )?.path
    }),
    [
      activeAgent,
      activeTaskId,
      activeWorkspaceId,
      messages,
      taskState?.status,
      workspaces
    ]
  );

  const activePanel =
    panels.find((panel) => panel.id === (rightActiveView || firstPanelId)) ??
    panels[0];
  const ActivePanelRender = activePanel?.Render;

  const tabButtons = useMemo(
    () =>
      panels.map((panel, index) => {
        const isActive = panel.id === (rightActiveView || firstPanelId);
        const isHovered = panel.id === hoveredPanelId;

        return (
          <Fragment key={panel.id}>
            {index > 0 ? (
              <span
                aria-label="Plugin right panel separator"
                role="separator"
                style={{
                  alignSelf: "center",
                  background: "var(--app-color-border-secondary)",
                  flexShrink: 0,
                  height: 14,
                  width: 1
                }}
              />
            ) : null}
            <Popover content={panel.title} placement="top" autoAdjustOverflow={false}>
              <button
                aria-label={panel.title}
                aria-selected={isActive}
                onClick={() => {
                  setRightActiveView(panel.id);
                }}
                onMouseEnter={() => {
                  setHoveredPanelId(panel.id);
                }}
                onMouseLeave={() => {
                  setHoveredPanelId("");
                }}
                role="tab"
                style={{
                  alignItems: "center",
                  background: isActive || isHovered
                    ? "var(--app-color-fill-secondary)"
                    : "transparent",
                  border: 0,
                  borderRadius: 5,
                  color: isActive
                    ? "var(--app-color-primary)"
                    : isHovered
                      ? "var(--app-color-text)"
                      : "var(--app-color-text-secondary)",
                  cursor: "pointer",
                  display: "inline-flex",
                  flexShrink: 0,
                  font: "inherit",
                  fontSize: 14,
                  height: 26,
                  justifyContent: "center",
                  lineHeight: 1,
                  padding: 0,
                  width: 26
                }}
                tabIndex={isActive ? 0 : -1}
                type="button"
              >
                {panel.icon}
              </button>
            </Popover>
          </Fragment>
        );
      }),
    [firstPanelId, hoveredPanelId, panels, rightActiveView, setRightActiveView]
  );

  if (!panels.length) {
    return null;
  }

  return (
    <section
      aria-label="Plugin right panels"
      style={{
        color: "var(--app-color-text)",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden"
      }}
    >
      <div
        aria-label="Plugin right panel tabs"
        role="tablist"
        style={{
          alignItems: "center",
          borderBottom: "1px solid var(--app-color-border-secondary)",
          display: "flex",
          flexShrink: 0,
          gap: 2,
          minHeight: 30,
          overflowX: "auto",
          paddingBottom: 6
        }}
      >
        {tabButtons}
      </div>
      <div
        role="tabpanel"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          paddingTop: 8
        }}
      >
        {ActivePanelRender ? <ActivePanelRender {...panelProps} /> : null}
      </div>
    </section>
  );
}
