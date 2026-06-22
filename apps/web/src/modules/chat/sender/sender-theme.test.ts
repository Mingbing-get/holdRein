// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function getWebSourcePath(pathFromWebSrc: string): string {
  const pathFromWebPackage = join(process.cwd(), "src", pathFromWebSrc);

  if (existsSync(pathFromWebPackage)) {
    return pathFromWebPackage;
  }

  return join(process.cwd(), "apps", "web", "src", pathFromWebSrc);
}

describe("sender select theme", () => {
  it("uses app theme variables for thinking level selected and focused states", () => {
    const senderSource = readFileSync(
      getWebSourcePath("modules/chat/sender/index.tsx"),
      "utf8"
    );

    expect(senderSource).toContain("ConfigProvider");
    expect(senderSource).toContain("senderSelectTheme");
    expect(senderSource).toContain('optionActiveBg: "var(--app-color-fill-secondary)"');
    expect(senderSource).toContain(
      'optionSelectedBg:\n        "color-mix(in srgb, var(--app-color-primary) 16%, var(--app-color-bg-elevated))"'
    );
    expect(senderSource).toContain('optionSelectedColor: "var(--app-color-text)"');
  });
});
