import { Popover } from "antd";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { Fragment } from "react";
import { useEffect, useMemo, useState } from "react";

import { useAppPlugins } from "../../../app/app-plugin";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import { useAgentTasks } from "../../agent-messages";

export default function RightPanel() {
  const { rightPanels } = useAppPlugins();
  const {
    state: { activeAgent, activeTaskId, activeWorkspaceId },
  } = useAppWorkspace();
  const { getTaskState } = useAgentTasks();
  const [activePanelId, setActivePanelId] = useState<string>("");
  const [hoveredPanelId, setHoveredPanelId] = useState<string>("");

  const taskState = getTaskState(activeTaskId);
  const firstPanelId = rightPanels[0]?.id ?? "";

  useEffect(() => {
    if (!rightPanels.length) {
      setActivePanelId("");
      return;
    }

    if (!rightPanels.some((panel) => panel.id === activePanelId)) {
      setActivePanelId(firstPanelId);
    }
  }, [activePanelId, firstPanelId, rightPanels]);

  const panelProps = useMemo<WebPlugin.RightPanelProps>(
    () => ({
      activeAgent,
      messages: taskState?.messages ?? [],
      status: taskState?.status ?? "idle",
      ...(activeTaskId ? { taskId: activeTaskId } : {}),
      ...(activeWorkspaceId ? { activeWorkspaceId } : {})
    }),
    [
      activeAgent,
      activeTaskId,
      activeWorkspaceId,
      taskState?.messages,
      taskState?.status
    ]
  );

  const activePanel =
    rightPanels.find((panel) => panel.id === (activePanelId || firstPanelId)) ??
    rightPanels[0];
  const ActivePanelRender = activePanel?.Render;

  const tabButtons = useMemo(
    () =>
      rightPanels.map((panel, index) => {
        const isActive = panel.id === (activePanelId || firstPanelId);
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
                  setActivePanelId(panel.id);
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
    [activePanelId, firstPanelId, hoveredPanelId, rightPanels]
  );

  if (!rightPanels.length) {
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
