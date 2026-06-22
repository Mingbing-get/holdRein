import { describe, expect, it } from "vitest";

import { SKILL_DIR } from "../../../config/const";
import { getSkillDirs } from "./support";

describe("agent runtime support", () => {
  it("always includes mandatory workspace and central skill directories", () => {
    expect(getSkillDirs("/tmp/workspace")).toEqual([
      "/tmp/workspace/.agents/skills",
      "/tmp/workspace/.hold-rein/skills",
      SKILL_DIR
    ]);
  });

  it("preserves configured skill directories after mandatory directories", () => {
    expect(getSkillDirs("/tmp/workspace", ["/plugin/skills"])).toEqual([
      "/tmp/workspace/.agents/skills",
      "/tmp/workspace/.hold-rein/skills",
      SKILL_DIR,
      "/plugin/skills"
    ]);
  });
});
