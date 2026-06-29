// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

import { require } from "./require";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (window as { requireCustom?: unknown }).requireCustom;
});

it("loads AMD modules with fetch text responses", async () => {
  const text = vi.fn(async () => 'define(() => ({ id: "demo" }));');
  const fetch = vi.fn(async () => ({
    text
  }));
  vi.stubGlobal("fetch", fetch);
  vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
    Function((node as HTMLScriptElement).innerText)();
    return node;
  });

  await expect(require.require(["/demo.js"], true)).resolves.toEqual([
    { id: "demo" }
  ]);
  expect(fetch).toHaveBeenCalledWith("/demo.js");
  expect(text).toHaveBeenCalledOnce();
});
