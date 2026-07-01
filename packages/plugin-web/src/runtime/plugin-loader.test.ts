// @vitest-environment jsdom

import { afterEach, expect, it, vi } from "vitest";

import { loadRuntimeWebPlugins } from "./plugin-loader";

afterEach(() => {
  document.head.innerHTML = "";
});

it("imports and registers web plugins", async () => {
  const register = vi.fn();

  const loadedPlugins = await loadRuntimeWebPlugins({
    importer: vi.fn(async () => ({ id: "demo" })),
    manifests: [
      {
        id: "demo",
        name: "Demo",
        packageName: "@scope/demo",
        version: "1.0.0",
        webEntry: "/demo.js"
      }
    ],
    registry: { has: () => false, register }
  });

  expect(register).toHaveBeenCalledWith({ id: "demo" });
  expect(loadedPlugins).toEqual([{ id: "demo" }]);
});

it("skips disabled web plugin manifests", async () => {
  const importer = vi.fn(async () => ({ id: "demo" }));
  const register = vi.fn();

  await loadRuntimeWebPlugins({
    importer,
    manifests: [
      {
        disabled: true,
        id: "demo",
        name: "Demo",
        packageName: "@scope/demo",
        version: "1.0.0",
        webEntry: "/demo.js"
      }
    ],
    registry: { has: () => false, register }
  });

  expect(importer).not.toHaveBeenCalled();
  expect(register).not.toHaveBeenCalled();
});

it("loads plugin styles before importing web plugins", async () => {
  const importer = vi.fn(async () => ({ id: "demo" }));

  await loadRuntimeWebPlugins({
    importer,
    manifests: [
      {
        id: "demo",
        name: "Demo",
        packageName: "@scope/demo",
        version: "1.0.0",
        webEntry: "/demo.js",
        webStyle: "/demo.css"
      }
    ],
    registry: { has: () => false, register: vi.fn() }
  });

  const link = document.head.querySelector<HTMLLinkElement>(
    'link[data-runtime-plugin-style="@scope/demo"]'
  );

  expect(link?.rel).toBe("stylesheet");
  expect(link?.href).toBe("http://localhost:3000/demo.css");
  expect(importer).toHaveBeenCalledWith("/demo.js");
});

it("does not duplicate existing plugin styles", async () => {
  const existing = document.createElement("link");
  existing.rel = "stylesheet";
  existing.href = "/demo.css";
  document.head.append(existing);

  await loadRuntimeWebPlugins({
    importer: vi.fn(async () => ({ id: "demo" })),
    manifests: [
      {
        id: "demo",
        name: "Demo",
        packageName: "@scope/demo",
        version: "1.0.0",
        webEntry: "/demo.js",
        webStyle: "/demo.css"
      }
    ],
    registry: { has: () => false, register: vi.fn() }
  });

  expect(document.head.querySelectorAll('link[href$="/demo.css"]')).toHaveLength(1);
});

it("skips plugins that are already registered under the imported module id", async () => {
  const register = vi.fn();

  const loadedPlugins = await loadRuntimeWebPlugins({
    importer: vi.fn(async () => ({ id: "module-demo" })),
    manifests: [
      {
        id: "manifest-demo",
        name: "Demo",
        packageName: "@scope/demo",
        version: "1.0.0",
        webEntry: "/demo.js"
      }
    ],
    registry: {
      has: (id) => id === "module-demo",
      register
    }
  });

  expect(register).not.toHaveBeenCalled();
  expect(loadedPlugins).toEqual([]);
});
