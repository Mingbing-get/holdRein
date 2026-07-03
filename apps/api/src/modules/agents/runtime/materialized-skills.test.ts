import { access, mkdir, readFile, rm, utimes } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  cleanupStaleMaterializedSkills,
  createWithMaterializedSkills,
  materializeInlineSkills
} from "./materialized-skills";

describe("materializeInlineSkills", () => {
  it("writes skill content and Markdown references to an isolated directory", async () => {
    const result = await materializeInlineSkills({
      rootDir: join(tmpdir(), "hold-rein-materialized-skills-tests"),
      skills: [
        {
          content: "# Reviewer\n\nRead ./references/guides/test.md.",
          description: "Review code",
          name: "reviewer",
          references: [
            { content: "# Test guide\n", path: "guides/test.md" }
          ]
        }
      ]
    });

    try {
      const [skill] = result.skills;
      if (!skill) throw new Error("Expected a materialized skill");
      expect(skill).toMatchObject({
        content: "# Reviewer\n\nRead ./references/guides/test.md.",
        description: "Review code",
        name: "reviewer"
      });
      expect(await readFile(skill.filePath, "utf8")).toBe(
        "# Reviewer\n\nRead ./references/guides/test.md."
      );
      expect(
        await readFile(
          join(skill.filePath, "..", "references", "guides", "test.md"),
          "utf8"
        )
      ).toBe("# Test guide\n");
    } finally {
      await result.cleanup();
    }

    await expect(access(result.directory)).rejects.toThrow();
  });

  it.each(["../secret.md", "/secret.md", "test.txt", "references/../test.md"])(
    "rejects unsafe reference path %s",
    async (path) => {
      await expect(
        materializeInlineSkills({
          rootDir: join(tmpdir(), "hold-rein-materialized-skills-tests"),
          skills: [
            {
              content: "# Reviewer",
              name: "reviewer",
              references: [{ content: "unsafe", path }]
            }
          ]
        })
      ).rejects.toThrow("Invalid skill reference path");
    }
  );

  it("removes stale harness directories while preserving recent ones", async () => {
    const rootDir = join(tmpdir(), `hold-rein-stale-skills-${Date.now()}`);
    const staleDirectory = join(rootDir, "harness-stale");
    const recentDirectory = join(rootDir, "harness-recent");
    await mkdir(staleDirectory, { recursive: true });
    await mkdir(recentDirectory, { recursive: true });
    await utimes(staleDirectory, new Date(0), new Date(0));

    try {
      await cleanupStaleMaterializedSkills({
        maxAgeMs: 60_000,
        now: Date.now(),
        rootDir
      });
      await expect(access(staleDirectory)).rejects.toThrow();
      await expect(access(recentDirectory)).resolves.toBeUndefined();
    } finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  it("cleans materialized files when harness construction fails", async () => {
    const result = await materializeInlineSkills({
      rootDir: join(tmpdir(), "hold-rein-materialized-skills-tests"),
      skills: [{ content: "# Reviewer", name: "reviewer" }]
    });

    await expect(createWithMaterializedSkills(result, () => {
      throw new Error("constructor failed");
    })).rejects.toThrow("constructor failed");
    await expect(access(result.directory)).rejects.toThrow();
  });
});
