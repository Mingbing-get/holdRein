import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("usage stats view styles", () => {
  it("keeps segmented container and items on the same radius", () => {
    const css = readFileSync(
      "src/modules/usage-stats/usage-stats-view.css",
      "utf8"
    );

    expect(css).toContain("--usage-stats-segmented-radius: 4px;");
    expect(css).toContain("border-radius: var(--usage-stats-segmented-radius);");
    expect(css).toContain(
      ".usage-stats-segmented .ant-segmented-item {\n  border-radius: var(--usage-stats-segmented-radius);"
    );
  });
});
