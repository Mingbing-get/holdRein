import { readFile } from "node:fs/promises";
import { join } from "node:path";

import simpleGit, { type SimpleGit, type StatusResult } from "simple-git";

export type GitRepositoryStatus =
  | { readonly initialized: false }
  | {
      readonly additions: number;
      readonly branches: readonly string[];
      readonly currentBranch: string;
      readonly deletions: number;
      readonly files: readonly string[];
      readonly hasChanges: boolean;
      readonly initialized: true;
    };

type InitializedGitRepositoryStatus = Extract<
  GitRepositoryStatus,
  { readonly initialized: true }
>;

export interface GitService {
  commit(message: string, push: boolean): Promise<void>;
  getStatus(): Promise<GitRepositoryStatus>;
  initialize(): Promise<void>;
  switchBranch(branch: string): Promise<void>;
}

export class GitConflictError extends Error {}

export class GitValidationError extends Error {}

export function createGitService(workspacePath: string): GitService {
  const git = simpleGit({ baseDir: workspacePath });

  return {
    async commit(message, push) {
      const normalizedMessage = message.trim();
      if (!normalizedMessage) {
        throw new GitValidationError("Commit message is required");
      }

      const status = await readRepositoryStatus(git, workspacePath);
      if (!status.hasChanges) {
        throw new GitConflictError("There are no changes to commit");
      }

      await git.add(".");
      await git.commit(normalizedMessage);
      if (push) {
        await git.push("origin", status.currentBranch);
      }
    },
    async getStatus() {
      if (!(await git.checkIsRepo())) {
        return { initialized: false };
      }

      return readRepositoryStatus(git, workspacePath);
    },
    async initialize() {
      await git.init();
    },
    async switchBranch(branch) {
      const status = await readRepositoryStatus(git, workspacePath);
      if (status.hasChanges) {
        throw new GitConflictError(
          "Commit or discard changes before switching branches"
        );
      }

      if (!status.branches.includes(branch)) {
        throw new GitValidationError(`Unknown local branch: ${branch}`);
      }

      await git.checkout(branch);
    }
  };
}

async function readRepositoryStatus(
  git: SimpleGit,
  workspacePath: string
): Promise<InitializedGitRepositoryStatus> {
  const [status, branchSummary] = await Promise.all([
    git.status(),
    git.branchLocal()
  ]);
  const trackedCounts = await readTrackedLineCounts(git);
  const untrackedAdditions = await countUntrackedLines(workspacePath, status);
  const files = status.files.map(({ path }) => path).sort();

  return {
    initialized: true,
    currentBranch: status.current ?? "",
    branches: [...branchSummary.all].sort(),
    additions: trackedCounts.additions + untrackedAdditions,
    deletions: trackedCounts.deletions,
    files,
    hasChanges: files.length > 0
  };
}

async function readTrackedLineCounts(
  git: SimpleGit
): Promise<{ additions: number; deletions: number }> {
  let output = "";

  try {
    output = await git.raw(["diff", "HEAD", "--numstat"]);
  } catch {
    output = await git.raw(["diff", "--numstat"]);
  }

  return output.split("\n").reduce(
    (totals, line) => {
      const [added, deleted] = line.split("\t");
      return {
        additions: totals.additions + parseCount(added),
        deletions: totals.deletions + parseCount(deleted)
      };
    },
    { additions: 0, deletions: 0 }
  );
}

async function countUntrackedLines(
  workspacePath: string,
  status: StatusResult
): Promise<number> {
  const counts = await Promise.all(
    status.not_added.map(async (path) => {
      const content = await readFile(join(workspacePath, path));
      if (content.includes(0)) {
        return 0;
      }

      const text = content.toString("utf8");
      if (text.length === 0) {
        return 0;
      }

      return text.endsWith("\n")
        ? text.split("\n").length - 1
        : text.split("\n").length;
    })
  );

  return counts.reduce((total, count) => total + count, 0);
}

function parseCount(value: string | undefined): number {
  return value && /^\d+$/u.test(value) ? Number(value) : 0;
}
