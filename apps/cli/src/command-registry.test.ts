import { describe, expect, it } from "vitest";

import { createCommand, formatCommandHelp } from "./command-registry";

describe("command registry help", () => {
  it("formats descriptions and options from nested commands", () => {
    const rootCommand = createCommand("hold-rein")
      .use(
        "workspace",
        createCommand("workspace", { description: "Manage workspaces" })
          .use(
            "list",
            createCommand("list", { description: "List recent workspaces" })
          )
          .use(
            "setting-update",
            createCommand("setting-update", {
              description: "Update workspace settings",
              usage: "setting-update <id>"
            }).option(
              "--active-plugins <ids>",
              "Replace active plugin ids with a comma-separated list"
            )
          )
      );

    expect(formatCommandHelp(rootCommand)).toEqual({
      commands: [
        ["workspace", "Manage workspaces"],
        ["workspace list", "List recent workspaces"],
        ["workspace setting-update <id>", "Update workspace settings"]
      ],
      options: [
        [
          "workspace setting-update <id> --active-plugins <ids>",
          "Replace active plugin ids with a comma-separated list"
        ]
      ]
    });
  });
});
