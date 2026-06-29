// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMock = vi.fn();
const registerRuntimePluginPackagesMock = vi.fn();
const createRootMock = vi.fn(() => ({
  render: renderMock
}));

let resetStylesLoaded = false;

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock
}));

vi.mock("./App", () => ({
  default: () => null
}));

vi.mock("./app/runtime-require", () => ({
  registerRuntimePluginPackages: registerRuntimePluginPackagesMock
}));

vi.mock("antd/dist/reset.css", () => {
  resetStylesLoaded = true;

  return {};
});

describe("main", () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = '<div id="root"></div>';
    renderMock.mockClear();
    registerRuntimePluginPackagesMock.mockClear();
    createRootMock.mockClear();
    resetStylesLoaded = false;
    vi.resetModules();
  });

  it("loads antd reset styles before rendering the app", async () => {
    await import("./main");

    expect(resetStylesLoaded).toBe(true);
    expect(createRootMock).toHaveBeenCalledWith(
      globalThis.document.getElementById("root")
    );
    expect(registerRuntimePluginPackagesMock).toHaveBeenCalledOnce();
    expect(renderMock).toHaveBeenCalledOnce();
  });
});
