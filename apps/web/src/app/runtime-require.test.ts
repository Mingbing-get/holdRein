// @vitest-environment jsdom

import { expect, it, vi } from "vitest";

vi.mock("@ant-design/icons", () => ({ IconProbe: "icons" }));
vi.mock("@hold-rein/plugin-web", () => ({
  require: {
    register: vi.fn()
  }
}));
vi.mock("@monaco-editor/react", () => ({ Editor: "editor" }));
vi.mock("antd", () => ({ Button: "button" }));
vi.mock("monaco-editor", () => ({ editor: "monaco-editor" }));
vi.mock("react", () => ({ createElement: "create-element" }));
vi.mock("react-dom", () => ({ createPortal: "create-portal" }));
vi.mock("react/jsx-runtime", () => ({ jsx: "jsx" }));

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
});
