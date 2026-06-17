import { readFile, readdir, stat } from "node:fs/promises";
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

export interface FileSystemFileContent {
  content: string;
  filePath: string;
}

export interface ListDirectoryOptions {
  parentPath?: string;
  rootPath?: string;
}

export interface ReadFileContentOptions {
  filePath: string;
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

export async function listDirectoryEntriesRecursive(
  options: ListDirectoryOptions = {}
): Promise<FileSystemDirectoryListing> {
  const rootPath = normalizeRootPath(options.rootPath);
  const parentPath = normalizeParentPath(rootPath, options.parentPath);
  const parentStat = await stat(parentPath);

  if (!parentStat.isDirectory()) {
    throw new Error("parentPath must be a directory");
  }

  return {
    entries: await listEntriesRecursive(parentPath),
    parentPath
  };
}

export async function readFileContent(
  options: ReadFileContentOptions
): Promise<FileSystemFileContent> {
  const rootPath = normalizeRootPath(options.rootPath);
  const filePath = normalizeFilePath(rootPath, options.filePath);
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    throw new Error("filePath must be a file");
  }

  return {
    content: await readFile(filePath, "utf8"),
    filePath
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

function normalizeFilePath(rootPath: string, filePath: string): string {
  const resolvedFilePath = resolve(filePath);

  if (!isPathInsideRoot(rootPath, resolvedFilePath)) {
    throw new Error("filePath must be inside the root directory");
  }

  return resolvedFilePath;
}

function isPathInsideRoot(rootPath: string, targetPath: string): boolean {
  const pathFromRoot = relative(rootPath, targetPath);

  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}

async function listEntriesRecursive(parentPath: string): Promise<FileSystemEntry[]> {
  const entries = await readdir(parentPath, { withFileTypes: true });
  const visibleEntries = entries
    .filter((entry) => !entry.name.startsWith("."))
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
    .sort(compareEntries);

  const nestedEntries = new Map(
    await Promise.all(
      visibleEntries
        .filter((entry) => entry.kind === "folder")
        .map(async (entry): Promise<[string, FileSystemEntry[]]> => [
          entry.path,
          await listEntriesRecursive(entry.path)
        ])
    )
  );

  return visibleEntries.flatMap((entry) => {
    if (entry.kind !== "folder") {
      return [entry];
    }

    return [entry, ...(nestedEntries.get(entry.path) ?? [])];
  });
}

function compareEntries(left: FileSystemEntry, right: FileSystemEntry): number {
  if (left.kind !== right.kind) {
    return left.kind === "folder" ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}
