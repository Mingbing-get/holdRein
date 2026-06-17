import { useCallback, useState } from "react";
import type { PropsWithChildren } from "react";

import { useAppUi } from "../../../app/app-ui-context";
import RightPanel from "./panel";

const MIN_RIGHT_SIDEBAR_WIDTH = 220;
const MAX_RIGHT_SIDEBAR_WIDTH = 640;

function clampRightSidebarWidth(width: number): number {
  return Math.min(
    MAX_RIGHT_SIDEBAR_WIDTH,
    Math.max(MIN_RIGHT_SIDEBAR_WIDTH, width)
  );
}

export function RightSideAside({ children }: PropsWithChildren) {
  const {
    state: {
      rightSidebarCollapsed,
      rightSidebarResizing,
      rightSidebarWidth
    },
    setRightSidebarResizing,
    setRightSidebarWidth
  } = useAppUi();
  const [isResizeHandleHovered, setIsResizeHandleHovered] = useState(false);
  const isResizeActive = rightSidebarResizing || isResizeHandleHovered;

  const startResizing = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const startX = event.clientX;
      const startWidth = rightSidebarWidth;
      setRightSidebarResizing(true);

      const resizeSidebar = (moveEvent: MouseEvent) => {
        setRightSidebarWidth(
          clampRightSidebarWidth(startWidth + startX - moveEvent.clientX)
        );
      };

      const stopResizing = () => {
        setRightSidebarResizing(false);
        document.removeEventListener("mousemove", resizeSidebar);
        document.removeEventListener("mouseup", stopResizing);
      };

      document.addEventListener("mousemove", resizeSidebar);
      document.addEventListener("mouseup", stopResizing);
    },
    [
      rightSidebarWidth,
      setRightSidebarResizing,
      setRightSidebarWidth
    ]
  );

  if (rightSidebarCollapsed) {
    return null;
  }

  return (
    <aside
      aria-label="Chat right sidebar"
      style={{
        borderLeft: `1px solid ${
          isResizeActive
            ? "var(--app-color-primary)"
            : "var(--app-color-border-secondary)"
        }`,
        color: "var(--app-color-text)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        minHeight: 0,
        padding: "10px 14px 14px 12px",
        position: "relative",
        transition: rightSidebarResizing ? "none" : "width 0.2s ease",
        width: rightSidebarWidth
      }}
    >
      {children ?? <RightPanel />}
      <div
        aria-label="Resize chat right sidebar"
        aria-orientation="vertical"
        onMouseDown={startResizing}
        onMouseEnter={() => {
          setIsResizeHandleHovered(true);
        }}
        onMouseLeave={() => {
          setIsResizeHandleHovered(false);
        }}
        role="separator"
        style={{
          bottom: 0,
          cursor: "col-resize",
          left: -5,
          position: "absolute",
          top: 0,
          width: 10
        }}
      />
    </aside>
  );
}
