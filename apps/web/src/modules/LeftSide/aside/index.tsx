import { useCallback, useState } from "react";
import type { PropsWithChildren } from "react";

import { useAppUi } from "../../../app/app-ui-context";
import { disableBodyTextSelection } from "../../sidebar/resize-text-selection";

const MIN_SIDEBAR_WIDTH = 120;
const MAX_SIDEBAR_WIDTH = 680;

function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function LeftSideAside({ children }: PropsWithChildren) {
  const {
    state: { sidebarCollapsed, sidebarResizing, sidebarWidth },
    setSidebarResizing,
    setSidebarWidth
  } = useAppUi();
  const [isResizeHandleHovered, setIsResizeHandleHovered] = useState(false);
  const isResizeActive = sidebarResizing || isResizeHandleHovered;

  const startResizing = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = sidebarWidth;
      const restoreBodyTextSelection = disableBodyTextSelection();
      setSidebarResizing(true);

      const resizeSidebar = (moveEvent: MouseEvent) => {
        setSidebarWidth(
          clampSidebarWidth(startWidth + moveEvent.clientX - startX)
        );
      };

      const stopResizing = () => {
        restoreBodyTextSelection();
        setSidebarResizing(false);
        document.removeEventListener("mousemove", resizeSidebar);
        document.removeEventListener("mouseup", stopResizing);
      };

      document.addEventListener("mousemove", resizeSidebar);
      document.addEventListener("mouseup", stopResizing);
    },
    [setSidebarResizing, setSidebarWidth, sidebarWidth]
  );

  return (
    <aside
      aria-label="Workspace sidebar"
      style={{
        borderRight: `1px solid ${
          isResizeActive
            ? "var(--app-color-primary)"
            : "var(--app-color-border-secondary)"
        }`,
        bottom: 0,
        color: "var(--app-color-text)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        left: 0,
        padding: 12,
        position: "fixed",
        top: 0,
        transition: sidebarResizing
          ? "transform 0.2s ease"
          : "transform 0.2s ease, width 0.2s ease",
        transform: sidebarCollapsed ? "translateX(-100%)" : "translateX(0)",
        visibility: sidebarCollapsed ? "hidden" : "visible",
        width: sidebarWidth
      }}
    >
      {children}
      <div
        aria-label="Resize workspace sidebar"
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
          position: "absolute",
          right: -5,
          top: 0,
          width: 10
        }}
      />
    </aside>
  );
}
