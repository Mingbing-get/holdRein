import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../app";
import { createSkillsService } from "./skills-service";

describe("skills routes", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "hold-rein-skills-router-"));
  });

  afterEach(async () => {
    await rm(rootDir, { force: true, recursive: true });
  });

  it("lists, toggles, installs and uninstalls skills", async () => {
    await createSkill("planner", "planner");
    const installGitRepository = vi.fn(async (_url: string, targetDir: string) => {
      await mkdir(targetDir, { recursive: true });
      await writeFile(
        join(targetDir, "SKILL.md"),
        "---\nname: review-helper\n---\n",
        "utf8"
      );
    });
    const service = createSkillsService({ installGitRepository, rootDir });
    const app = await createApp({ skillsService: service });

    const listResponse = await request(app).get("/api/v1/skills");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.skills).toEqual([
      expect.objectContaining({ disabled: false, id: "planner" })
    ]);

    const disableResponse = await request(app)
      .patch("/api/v1/skills/planner")
      .send({ disabled: true });

    expect(disableResponse.status).toBe(200);
    expect(disableResponse.body.data).toEqual(
      expect.objectContaining({ disabled: true, id: "planner" })
    );

    const installResponse = await request(app)
      .post("/api/v1/skills/install")
      .send({ repositoryUrl: "https://github.com/acme/review-helper.git" });

    expect(installResponse.status).toBe(200);
    expect(installResponse.body.data).toEqual(
      expect.objectContaining({ disabled: false, id: "review-helper" })
    );

    const uninstallResponse = await request(app).delete(
      "/api/v1/skills/review-helper"
    );

    expect(uninstallResponse.status).toBe(200);
    expect(uninstallResponse.body.data).toEqual({ id: "review-helper" });
  });

  async function createSkill(id: string, name: string) {
    const skillDir = join(rootDir, id);

    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  }
});
