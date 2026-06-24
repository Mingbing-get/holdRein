import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSkillInstallUrl,
  createSkillUrl,
  fetchInstalledSkills,
  installSkill,
  setSkillDisabled,
  uninstallSkill
} from "./skill-management-api";

const fetchMock = vi.fn<typeof fetch>();

describe("skill management api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds skill urls", () => {
    expect(createSkillUrl("http://localhost:4000/", "review helper")).toBe(
      "http://localhost:4000/api/v1/skills/review%20helper"
    );
    expect(createSkillInstallUrl("http://localhost:4000")).toBe(
      "http://localhost:4000/api/v1/skills/install"
    );
  });

  it("loads and mutates skills", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: { skills: [{ disabled: false, id: "planning", name: "planning" }] },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: { disabled: true, id: "planning", name: "planning" },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: { disabled: false, id: "review-helper", name: "review-helper" },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: { id: "planning" }, msg: "ok" }),
        ok: true
      } as Response);

    await expect(fetchInstalledSkills("http://localhost:4000")).resolves.toEqual([
      { disabled: false, id: "planning", name: "planning" }
    ]);
    await setSkillDisabled("http://localhost:4000", "planning", true);
    await installSkill(
      "http://localhost:4000",
      "https://github.com/acme/review-helper.git"
    );
    await uninstallSkill("http://localhost:4000", "planning");

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/skills/planning",
      {
        body: JSON.stringify({ disabled: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/v1/skills/install",
      {
        body: JSON.stringify({
          repositoryUrl: "https://github.com/acme/review-helper.git"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:4000/api/v1/skills/planning",
      { method: "DELETE" }
    );
  });
});
