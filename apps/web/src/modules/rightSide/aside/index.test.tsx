// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppUiProvider } from "../../../app/app-ui-context";
import { RightSideAside } from ".";

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

describe("RightSideAside", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("prevents text selection while resizing", () => {
    document.body.style.userSelect = "text";
    window.localStorage.setItem("hold-rein.right-sidebar-collapsed", "false");
    renderRightSideAside(<div />);

    const resizeHandle = screen.getByRole("separator", {
      name: "Resize chat right sidebar"
    });

    fireEvent.mouseDown(resizeHandle, { clientX: 700 });

    expect(document.body).toHaveStyle({ userSelect: "none" });

    fireEvent.mouseUp(document);

    expect(document.body).toHaveStyle({ userSelect: "text" });
  });
});

function renderRightSideAside(children: React.ReactNode) {
  render(
    <AppUiProvider>
      <RightSideAside>{children}</RightSideAside>
    </AppUiProvider>
  );
}
