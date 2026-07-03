import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createGitService, GitConflictError } from "./git-service";

const execFileAsync = promisify(execFile);

describe("GitService status", () => {
  it("reports an uninitialized workspace", async () => {
    const workspacePath = await createWorkspace();

    await expect(createGitService(workspacePath).getStatus()).resolves.toEqual({
      initialized: false
    });
  });

  it("represents an initialized repository without commits", async () => {
    const workspacePath = await createWorkspace();
    await git(workspacePath, "init", "--initial-branch=main");

    await expect(createGitService(workspacePath).getStatus()).resolves.toEqual({
      initialized: true,
      currentBranch: "main",
      branches: [],
      additions: 0,
      deletions: 0,
      files: [],
      hasChanges: false
    });
  });

  it("reports local branches and changed files with aggregate line counts", async () => {
    const workspacePath = await createRepository();
    await git(workspacePath, "branch", "feature/demo");
    await writeFile(join(workspacePath, "tracked.txt"), "one\ntwo changed\nthree\n");
    await writeFile(join(workspacePath, "new.txt"), "alpha\nbeta\n");

    const status = await createGitService(workspacePath).getStatus();

    expect(status).toEqual({
      initialized: true,
      currentBranch: "main",
      branches: ["feature/demo", "main"],
      additions: 3,
      deletions: 1,
      files: ["new.txt", "tracked.txt"],
      hasChanges: true
    });
  });
});

describe("GitService file diff", () => {
  it("returns the diff for a changed tracked file", async () => {
    const workspacePath = await createRepository();
    await writeFile(join(workspacePath, "tracked.txt"), "one\ntwo changed\nthree\n");

    const diff = await createGitService(workspacePath).getFileDiff("tracked.txt");

    expect(diff).toContain("diff --git a/tracked.txt b/tracked.txt");
    expect(diff).toContain("-two");
    expect(diff).toContain("+two changed");
  });

  it("returns a unified diff for an untracked text file", async () => {
    const workspacePath = await createRepository();
    await mkdir(join(workspacePath, "src"));
    await writeFile(join(workspacePath, "src/new.ts"), "export const value = 1;\n");

    const diff = await createGitService(workspacePath).getFileDiff("src/new.ts");

    expect(diff).toContain("diff --git a/src/new.ts b/src/new.ts");
    expect(diff).toContain("new file mode");
    expect(diff).toContain("+export const value = 1;");
  });

  it("rejects paths outside the repository", async () => {
    const workspacePath = await createRepository();

    await expect(
      createGitService(workspacePath).getFileDiff("../outside.txt")
    ).rejects.toThrow("File path must be relative to the repository");
  });
});

describe("GitService mutations", () => {
  it("initializes a workspace", async () => {
    const workspacePath = await createWorkspace();
    const service = createGitService(workspacePath);

    await service.initialize();

    await expect(service.getStatus()).resolves.toMatchObject({ initialized: true });
  });

  it("rejects switching branches when the worktree is dirty", async () => {
    const workspacePath = await createRepository();
    await git(workspacePath, "branch", "feature/demo");
    await writeFile(join(workspacePath, "tracked.txt"), "dirty\n");

    await expect(
      createGitService(workspacePath).switchBranch("feature/demo")
    ).rejects.toBeInstanceOf(GitConflictError);
    await expect(currentBranch(workspacePath)).resolves.toBe("main");
  });

  it("switches branches when the worktree is clean", async () => {
    const workspacePath = await createRepository();
    await git(workspacePath, "branch", "feature/demo");

    await createGitService(workspacePath).switchBranch("feature/demo");

    await expect(currentBranch(workspacePath)).resolves.toBe("feature/demo");
  });

  it("rejects an empty commit message", async () => {
    const workspacePath = await createRepository();
    await writeFile(join(workspacePath, "new.txt"), "new\n");

    await expect(
      createGitService(workspacePath).commit("   ", false)
    ).rejects.toThrow("Commit message is required");
  });

  it("stages and commits all changes", async () => {
    const workspacePath = await createRepository();
    await writeFile(join(workspacePath, "new.txt"), "new\n");

    await createGitService(workspacePath).commit("add new file", false);

    expect(await lastCommitSubject(workspacePath)).toBe("add new file");
    await expect(createGitService(workspacePath).getStatus()).resolves.toMatchObject({
      hasChanges: false
    });
  });

  it("pushes the current branch after committing", async () => {
    const workspacePath = await createRepository();
    const remotePath = await createBareRepository();
    await git(workspacePath, "remote", "add", "origin", remotePath);
    await writeFile(join(workspacePath, "new.txt"), "new\n");

    await createGitService(workspacePath).commit("push new file", true);

    const { stdout } = await execFileAsync(
      "git",
      ["--git-dir", remotePath, "log", "-1", "--format=%s", "main"]
    );
    expect(stdout.trim()).toBe("push new file");
  });
});

async function createWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "hold-rein-github-plugin-"));
}

async function createRepository(): Promise<string> {
  const workspacePath = await createWorkspace();
  await git(workspacePath, "init", "--initial-branch=main");
  await git(workspacePath, "config", "user.name", "Hold Rein Test");
  await git(workspacePath, "config", "user.email", "test@hold-rein.local");
  await writeFile(join(workspacePath, "tracked.txt"), "one\ntwo\nthree\n");
  await git(workspacePath, "add", ".");
  await git(workspacePath, "commit", "-m", "initial");
  return workspacePath;
}

async function createBareRepository(): Promise<string> {
  const repositoryPath = await createWorkspace();
  await execFileAsync("git", ["init", "--bare", repositoryPath]);
  return repositoryPath;
}

async function currentBranch(workspacePath: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["branch", "--show-current"],
    { cwd: workspacePath }
  );
  return stdout.trim();
}

async function lastCommitSubject(workspacePath: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["log", "-1", "--format=%s"],
    { cwd: workspacePath }
  );
  return stdout.trim();
}

async function git(workspacePath: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd: workspacePath });
}
