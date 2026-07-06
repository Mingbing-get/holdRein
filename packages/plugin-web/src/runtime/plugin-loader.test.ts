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

it("imports module web plugin entries with the module importer", async () => {
  const importer = vi.fn(async () => ({ id: "umd-demo" }));
  const moduleImporter = vi.fn(async () => ({ default: { id: "module-demo" } }));
  const register = vi.fn();

  const loadedPlugins = await loadRuntimeWebPlugins({
    importer,
    moduleImporter,
    manifests: [
      {
        dev: true,
        id: "module-demo",
        name: "Module Demo",
        packageName: "@scope/module-demo",
        version: "0.0.0",
        webEntry: "http://127.0.0.1:5178/src/web.ts",
        webEntryType: "module"
      }
    ],
    registry: { has: () => false, register }
  });

  expect(importer).not.toHaveBeenCalled();
  expect(moduleImporter).toHaveBeenCalledWith(
    "http://127.0.0.1:5178/src/web.ts"
  );
  expect(register).toHaveBeenCalledWith({ id: "module-demo" });
  expect(loadedPlugins).toEqual([{ id: "module-demo" }]);
});

it("keeps the UMD importer for missing or UMD web entry types", async () => {
  const importer = vi
    .fn()
    .mockResolvedValueOnce({ id: "implicit-umd" })
    .mockResolvedValueOnce({ id: "explicit-umd" });
  const moduleImporter = vi.fn(async () => ({ default: { id: "module-demo" } }));
  const register = vi.fn();

  await loadRuntimeWebPlugins({
    importer,
    moduleImporter,
    manifests: [
      {
        id: "implicit-umd",
        name: "Implicit UMD",
        packageName: "@scope/implicit-umd",
        version: "1.0.0",
        webEntry: "/implicit.js"
      },
      {
        id: "explicit-umd",
        name: "Explicit UMD",
        packageName: "@scope/explicit-umd",
        version: "1.0.0",
        webEntry: "/explicit.js",
        webEntryType: "umd"
      }
    ],
    registry: { has: () => false, register }
  });

  expect(importer).toHaveBeenCalledWith("/implicit.js");
  expect(importer).toHaveBeenCalledWith("/explicit.js");
  expect(moduleImporter).not.toHaveBeenCalled();
  expect(register).toHaveBeenCalledWith({ id: "implicit-umd" });
  expect(register).toHaveBeenCalledWith({ id: "explicit-umd" });
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
