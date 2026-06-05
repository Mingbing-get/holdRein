import { readdir, stat } from "node:fs/promises";
import { extname, isAbsolute, parse, relative, resolve } from "node:path";

export type FileSystemEntryKind = "file" | "folder";

export interface FileSystemEntry {
  extension: string;
  kind: FileSystemEntryKind;
  name: string;
  path: string;
}

export interface FileSystemDirectoryListing {
  entries: FileSystemEntry[];
  parentPath: string;
}

export interface ListDirectoryOptions {
  parentPath?: string;
  rootPath?: string;
}

export async function listDirectoryEntries(
  options: ListDirectoryOptions = {}
): Promise<FileSystemDirectoryListing> {
  const rootPath = normalizeRootPath(options.rootPath);
  const parentPath = normalizeParentPath(rootPath, options.parentPath);
  const parentStat = await stat(parentPath);

  if (!parentStat.isDirectory()) {
    throw new Error("parentPath must be a directory");
  }

  const entries = await readdir(parentPath, { withFileTypes: true });
  const visibleEntries = entries.filter((entry) => !entry.name.startsWith("."));

  return {
    entries: visibleEntries
      .filter((entry) => entry.isDirectory() || entry.isFile())
      .map<FileSystemEntry>((entry) => {
        const entryPath = resolve(parentPath, entry.name);
        const isDirectory = entry.isDirectory();

        return {
          extension: isDirectory ? "" : extname(entry.name),
          kind: isDirectory ? "folder" : "file",
          name: entry.name,
          path: entryPath
        };
      })
      .sort(compareEntries),
    parentPath
  };
}

function normalizeRootPath(rootPath?: string): string {
  return rootPath ? resolve(rootPath) : parse(process.cwd()).root;
}

function normalizeParentPath(rootPath: string, parentPath?: string): string {
  const resolvedParentPath = parentPath
    ? resolve(parentPath)
    : rootPath;

  if (!isPathInsideRoot(rootPath, resolvedParentPath)) {
    throw new Error("parentPath must be inside the root directory");
  }

  return resolvedParentPath;
}

function isPathInsideRoot(rootPath: string, targetPath: string): boolean {
  const pathFromRoot = relative(rootPath, targetPath);

  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}

function compareEntries(left: FileSystemEntry, right: FileSystemEntry): number {
  if (left.kind !== right.kind) {
    return left.kind === "folder" ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}
