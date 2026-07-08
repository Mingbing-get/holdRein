import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const CSS_PATH = join(dirname(fileURLToPath(import.meta.url)), "gomoku-panel.css");

describe("gomoku panel styles", () => {
  it("keeps the latest move blinking until another move takes over", async () => {
    const css = await readFile(CSS_PATH, "utf8");

    expect(css).toContain(
      "animation: gomoku-last-move-pulse 1.15s ease-in-out infinite;"
    );
    expect(css).toContain(
      "animation: gomoku-last-stone-blink 1.15s ease-in-out infinite;"
    );
  });

  it("does not draw board-level center cross lines", async () => {
    const css = await readFile(CSS_PATH, "utf8");
    const boardRule = css.match(/\.gomoku-board\s*\{(?<body>[^}]*)\}/)?.groups
      ?.body;

    expect(boardRule).toBeDefined();
    expect(boardRule).not.toContain("linear-gradient");
  });

  it("keeps cells square as board sizes change", async () => {
    const css = await readFile(CSS_PATH, "utf8");
    const cellRule = css.match(/\.gomoku-cell\s*\{(?<body>[^}]*)\}/)?.groups
      ?.body;

    expect(cellRule).toBeDefined();
    expect(cellRule).toContain("aspect-ratio: 1;");
  });
});
