// @vitest-environment jsdom

import { beforeEach, expect, it, vi } from "vitest";

const IconDefault = vi.fn();
const MonacoDefault = vi.fn();
const jsxMock = vi.hoisted(() =>
  vi.fn((type: unknown, props: unknown, key: unknown) => ({
    key,
    props,
    runtime: "jsx",
    type
  }))
);
const jsxsMock = vi.hoisted(() =>
  vi.fn((type: unknown, props: unknown, key: unknown) => ({
    key,
    props,
    runtime: "jsxs",
    type
  }))
);

vi.mock("@ant-design/icons", () => ({
  default: IconDefault,
  IconProbe: "icons"
}));
vi.mock("@hold-rein/plugin-web", () => ({
  require: {
    register: vi.fn()
  }
}));
vi.mock("@monaco-editor/react", () => ({
  default: MonacoDefault,
  DiffEditor: "diff-editor"
}));
vi.mock("antd", () => ({ Button: "button" }));
vi.mock("monaco-editor", () => ({ editor: "monaco-editor" }));
vi.mock("react", () => ({ createElement: "create-element" }));
vi.mock("react-dom", () => ({ createPortal: "create-portal" }));
vi.mock("react/jsx-dev-runtime", () => ({
  Fragment: "fragment",
  jsxDEV: undefined
}));
vi.mock("react/jsx-runtime", () => ({
  Fragment: "fragment",
  jsx: jsxMock,
  jsxs: jsxsMock
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete (
    globalThis as typeof globalThis & {
      __HOLD_REIN_SHARED__?: unknown;
    }
  ).__HOLD_REIN_SHARED__;
});

it("registers host packages for runtime plugins", async () => {
  const { require } = await import("@hold-rein/plugin-web");
  const { registerRuntimePluginPackages } = await import("./runtime-require");

  registerRuntimePluginPackages();

  expect(require.register).toHaveBeenCalledWith("react", expect.anything());
  expect(require.register).toHaveBeenCalledWith("react-dom", expect.anything());
  expect(require.register).toHaveBeenCalledWith(
    "react/jsx-runtime",
    expect.anything()
  );
  expect(require.register).toHaveBeenCalledWith(
    "react/jsx-dev-runtime",
    expect.anything()
  );
  expect(require.register).toHaveBeenCalledWith("antd", expect.anything());
  expect(require.register).toHaveBeenCalledWith(
    "@ant-design/icons",
    expect.anything()
  );
  expect(require.register).toHaveBeenCalledWith(
    "@hold-rein/plugin-web",
    expect.anything()
  );
  expect(require.register).toHaveBeenCalledWith(
    "@monaco-editor/react",
    expect.anything()
  );
  expect(require.register).toHaveBeenCalledWith(
    "monaco-editor",
    expect.anything()
  );

  const jsxDevRegistration = vi
    .mocked(require.register)
    .mock.calls.find(([packageName]) => packageName === "react/jsx-dev-runtime");

  expect(jsxDevRegistration?.[1]).toMatchObject({
    jsxDEV: expect.any(Function)
  });
});

it("registers host packages as shared ESM globals for development plugins", async () => {
  const { registerRuntimePluginPackages } = await import("./runtime-require");

  registerRuntimePluginPackages();

  expect(
    (
      globalThis as typeof globalThis & {
        __HOLD_REIN_SHARED__?: Record<string, unknown>;
      }
    ).__HOLD_REIN_SHARED__
  ).toMatchObject({
    antd: { Button: "button" },
    icons: expect.any(Function),
    monaco: { editor: "monaco-editor" },
    monacoReact: expect.any(Function),
    pluginWeb: expect.objectContaining({ require: expect.anything() }),
    react: { createElement: "create-element" },
    reactDom: { createPortal: "create-portal" },
    reactJsxDevRuntime: { Fragment: "fragment", jsxDEV: expect.any(Function) },
    reactJsxRuntime: { Fragment: "fragment", jsx: jsxMock, jsxs: jsxsMock }
  });
});

it("provides jsxDEV for development plugins when the host bundle uses React production runtime", async () => {
  const { registerRuntimePluginPackages } = await import("./runtime-require");

  registerRuntimePluginPackages();

  const shared = (
    globalThis as typeof globalThis & {
      __HOLD_REIN_SHARED__?: {
        reactJsxDevRuntime: {
          jsxDEV: (
            type: unknown,
            props: unknown,
            key: unknown,
            isStaticChildren: boolean
          ) => unknown;
        };
      };
    }
  ).__HOLD_REIN_SHARED__;

  expect(shared?.reactJsxDevRuntime.jsxDEV("div", { id: "one" }, "a", false))
    .toEqual({
      key: "a",
      props: { id: "one" },
      runtime: "jsx",
      type: "div"
    });
  expect(shared?.reactJsxDevRuntime.jsxDEV("div", { children: [] }, "b", true))
    .toEqual({
      key: "b",
      props: { children: [] },
      runtime: "jsxs",
      type: "div"
    });
});

it("registers default exports as AMD module values with named exports attached", async () => {
  const { require } = await import("@hold-rein/plugin-web");
  const { registerRuntimePluginPackages } = await import("./runtime-require");

  registerRuntimePluginPackages();

  const iconRegistration = vi
    .mocked(require.register)
    .mock.calls.find(([packageName]) => packageName === "@ant-design/icons");
  const monacoRegistration = vi
    .mocked(require.register)
    .mock.calls.find(([packageName]) => packageName === "@monaco-editor/react");

  expect(typeof iconRegistration?.[1]).toBe("function");
  expect((iconRegistration?.[1] as { IconProbe?: unknown }).IconProbe).toBe(
    "icons"
  );

  expect(typeof monacoRegistration?.[1]).toBe("function");
  expect((monacoRegistration?.[1] as { DiffEditor?: unknown }).DiffEditor).toBe(
    "diff-editor"
  );
});
