// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

import { require } from "./require";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  require.clearForTests();
  delete (window as { requireCustom?: unknown }).requireCustom;
});

it("loads AMD modules with fetch text responses", async () => {
  const text = vi.fn(async () => 'define(() => ({ id: "demo" }));');
  const fetch = vi.fn(async () => ({
    text
  }));
  vi.stubGlobal("fetch", fetch);
  vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
    Function((node as HTMLScriptElement).textContent ?? "")();
    return node;
  });

  await expect(require.require(["/demo.js"], true)).resolves.toEqual([
    { id: "demo" }
  ]);
  expect(fetch).toHaveBeenCalledWith("/demo.js");
  expect(text).toHaveBeenCalledOnce();
});

it("resolves registered dependencies for UMD-style AMD modules", async () => {
  require.register("react", { createElement: "host-react" });

  const text = vi.fn(async () =>
    [
      'define(["exports", "react"], (exports, React) => {',
      '  exports.default = { id: "demo", React };',
      "});"
    ].join("\n")
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ text }))
  );
  vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
    Function((node as HTMLScriptElement).textContent ?? "")();
    return node;
  });

  await expect(require.require(["/demo.js"], true)).resolves.toEqual([
    { default: { id: "demo", React: { createElement: "host-react" } } }
  ]);
});

it("loads modules through configured aliases", async () => {
  require.setPath({ demo: "/assets/demo.js" });

  const text = vi.fn(async () => 'define(() => ({ id: "aliased" }));');
  const fetch = vi.fn(async () => ({ text }));
  vi.stubGlobal("fetch", fetch);
  vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
    Function((node as HTMLScriptElement).textContent ?? "")();
    return node;
  });

  await expect(require.require(["demo"], true)).resolves.toEqual([
    { id: "aliased" }
  ]);
  expect(fetch).toHaveBeenCalledWith("/assets/demo.js");
});
