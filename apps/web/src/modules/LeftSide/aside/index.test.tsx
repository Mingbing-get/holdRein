// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppUiProvider, useAppUi } from "../../../app/app-ui-context";
import { LeftSideAside } from ".";

class ResizeObserverMock {
  disconnect() {
    return undefined;
  }

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }
}

function createMatchMediaMock(): typeof window.matchMedia {
  return ((query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined
  })) as typeof window.matchMedia;
}

describe("LeftSideAside", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a fixed sidebar shell without owning navigation content", () => {
    renderLeftSideAside(<div data-testid="aside-content">Custom content</div>);

    const aside = screen.getByLabelText("Workspace sidebar");

    expect(screen.getByTestId("aside-content")).toBeInTheDocument();
    expect(aside).toHaveStyle({
      position: "fixed",
      width: "240px"
    });
  });

  it("clamps dragged width within sidebar bounds", () => {
    renderLeftSideAside(<div />);

    const aside = screen.getByLabelText("Workspace sidebar");
    const resizeHandle = screen.getByRole("separator", {
      name: "Resize workspace sidebar"
    });

    fireEvent.mouseDown(resizeHandle, { clientX: 240 });
    fireEvent.mouseMove(document, { clientX: 40 });

    expect(aside).toHaveStyle({ width: "120px" });

    fireEvent.mouseMove(document, { clientX: 1200 });

    expect(aside).toHaveStyle({ width: "680px" });

    fireEvent.mouseUp(document);
  });

  it("prevents text selection while resizing", () => {
    document.body.style.userSelect = "text";
    renderLeftSideAside(<div />);

    const resizeHandle = screen.getByRole("separator", {
      name: "Resize workspace sidebar"
    });

    fireEvent.mouseDown(resizeHandle, { clientX: 240 });

    expect(document.body).toHaveStyle({ userSelect: "none" });

    fireEvent.mouseUp(document);

    expect(document.body).toHaveStyle({ userSelect: "text" });
  });

  it("hides the shell when the app sidebar is collapsed", () => {
    render(
      <AppUiProvider>
        <CollapseSidebar />
        <LeftSideAside>
          <div />
        </LeftSideAside>
      </AppUiProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "collapse sidebar" }));

    expect(screen.getByLabelText("Workspace sidebar")).toHaveStyle({
      transform: "translateX(-100%)",
      visibility: "hidden"
    });
  });
});

function CollapseSidebar() {
  const { toggleSidebar } = useAppUi();

  return (
    <button onClick={toggleSidebar} type="button">
      collapse sidebar
    </button>
  );
}

function renderLeftSideAside(children: React.ReactNode) {
  render(
    <AppUiProvider>
      <LeftSideAside>{children}</LeftSideAside>
    </AppUiProvider>
  );
}
