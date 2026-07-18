import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, parse, relative, resolve } from "node:path";

export type FileSystemEntryKind = "file" | "folder";

export interface FileSystemEntry {
  children?: FileSystemEntry[];
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

export interface FileSystemFileDownload { filePath: string; name: string; }

export interface CreateFolderOptions {
  name: string;
  parentPath?: string;
  rootPath?: string;
}

export interface ListDirectoryOptions {
  ignores?: string[];
  parentPath?: string;
  rootPath?: string;
  useGitIgnore?: boolean;
}

export interface ReadFileContentOptions {
  filePath: string;
  rootPath?: string;
}

export interface DeleteEntryOptions {
  entryPath: string;
  rootPath?: string;
}

export interface UploadFileInput { content: Buffer; name: string; }

export interface UploadFilesOptions {
  files: UploadFileInput[];
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

export async function listDirectoryEntriesRecursive(
  options: ListDirectoryOptions = {}
): Promise<FileSystemDirectoryListing> {
  const rootPath = normalizeRootPath(options.rootPath);
  const parentPath = normalizeParentPath(rootPath, options.parentPath);
  const parentStat = await stat(parentPath);

  if (!parentStat.isDirectory()) {
    throw new Error("parentPath must be a directory");
  }

  const ignoreMatcher = await createIgnoreMatcher(parentPath, options);

  return {
    entries: await listEntriesRecursive(parentPath, ignoreMatcher),
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

export async function getFileDownload(options: ReadFileContentOptions): Promise<FileSystemFileDownload> {
  const rootPath = normalizeRootPath(options.rootPath);
  const filePath = normalizeFilePath(rootPath, options.filePath);
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    throw new Error("filePath must be a file");
  }

  return { filePath, name: basename(filePath) };
}

export async function createFolder(
  options: CreateFolderOptions
): Promise<FileSystemEntry> {
  const rootPath = normalizeRootPath(options.rootPath);
  const parentPath = normalizeParentPath(rootPath, options.parentPath);
  const parentStat = await stat(parentPath);

  if (!parentStat.isDirectory()) {
    throw new Error("parentPath must be a directory");
  }

  const folderName = normalizeFolderName(options.name);
  const folderPath = resolve(parentPath, folderName);

  if (!isPathInsideRoot(rootPath, folderPath)) {
    throw new Error("folder path must be inside the root directory");
  }

  try {
    await mkdir(folderPath);
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new Error("folder name already exists");
    }

    throw error;
  }

  return {
    extension: "",
    kind: "folder",
    name: folderName,
    path: folderPath
  };
}

export async function uploadFiles(options: UploadFilesOptions): Promise<FileSystemEntry[]> {
  const rootPath = normalizeRootPath(options.rootPath);
  const parentPath = normalizeParentPath(rootPath, options.parentPath);
  const parentStat = await stat(parentPath);

  if (!parentStat.isDirectory()) {
    throw new Error("parentPath must be a directory");
  }

  if (options.files.length === 0) {
    throw new Error("files are required");
  }

  const writtenEntries: FileSystemEntry[] = [];

  for (const file of options.files) {
    const fileName = normalizeFileName(file.name);
    const filePath = resolve(parentPath, fileName);

    if (!isPathInsideRoot(rootPath, filePath)) {
      throw new Error("file path must be inside the root directory");
    }

    await writeFile(filePath, file.content);
    writtenEntries.push({ extension: extname(fileName), kind: "file", name: fileName, path: filePath });
  }

  return writtenEntries;
}

export async function deleteEntry(
  options: DeleteEntryOptions
): Promise<FileSystemEntry> {
  const rootPath = normalizeRootPath(options.rootPath);
  const entryPath = normalizeEntryPath(rootPath, options.entryPath);
  const entryStat = await stat(entryPath);
  const isDirectory = entryStat.isDirectory();

  if (!isDirectory && !entryStat.isFile()) {
    throw new Error("entryPath must be a file or directory");
  }

  await rm(entryPath, { recursive: isDirectory });

  return {
    extension: isDirectory ? "" : extname(entryPath),
    kind: isDirectory ? "folder" : "file",
    name: basename(entryPath),
    path: entryPath
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

function normalizeEntryPath(rootPath: string, entryPath: string): string {
  const resolvedEntryPath = resolve(entryPath);

  if (!isPathInsideRoot(rootPath, resolvedEntryPath)) {
    throw new Error("entryPath must be inside the root directory");
  }

  if (resolvedEntryPath === rootPath) {
    throw new Error("entryPath must be below the root directory");
  }

  return resolvedEntryPath;
}

function normalizeFolderName(name: string): string {
  const folderName = name.trim();

  if (!folderName) {
    throw new Error("folder name is required");
  }

  if (folderName === "." || folderName === ".." || folderName.includes("/") || folderName.includes("\\")) {
    throw new Error("folder name must be a single path segment");
  }

  return folderName;
}

function normalizeFileName(name: string): string {
  const fileName = name.trim();

  if (!fileName) {
    throw new Error("file name is required");
  }

  if (fileName === "." || fileName === ".." || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("file name must be a single path segment");
  }

  return fileName;
}

function isPathInsideRoot(rootPath: string, targetPath: string): boolean {
  const pathFromRoot = relative(rootPath, targetPath);

  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}

type IgnoreMatcher = (entryPath: string, name: string, isDirectory: boolean) => boolean;

interface GitIgnoreRule {
  directoryOnly: boolean;
  hasSlash: boolean;
  ignored: boolean;
  pattern: string;
  regex: RegExp;
}

async function createIgnoreMatcher(
  parentPath: string,
  options: ListDirectoryOptions
): Promise<IgnoreMatcher> {
  const ignoredNames = new Set(options.ignores ?? []);
  const gitIgnoreRules = options.useGitIgnore
    ? await loadGitIgnoreRules(parentPath)
    : [];

  return (entryPath, name, isDirectory) => {
    if (ignoredNames.has(name)) {
      return true;
    }

    const relativeEntryPath = normalizeRelativePath(relative(parentPath, entryPath));

    return isIgnoredByGitIgnoreRules(
      relativeEntryPath,
      name,
      isDirectory,
      gitIgnoreRules
    );
  };
}

async function listEntriesRecursive(
  parentPath: string,
  ignoreMatcher: IgnoreMatcher
): Promise<FileSystemEntry[]> {
  const entries = await readdir(parentPath, { withFileTypes: true });
  const visibleEntries = await Promise.all(entries
    .filter((entry) => !entry.name.startsWith("."))
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .filter((entry) => {
      const entryPath = resolve(parentPath, entry.name);

      return !ignoreMatcher(entryPath, entry.name, entry.isDirectory());
    })
    .map<Promise<FileSystemEntry>>(async (entry) => {
      const entryPath = resolve(parentPath, entry.name);
      const isDirectory = entry.isDirectory();

      return {
        ...(isDirectory
          ? { children: await listEntriesRecursive(entryPath, ignoreMatcher) }
          : {}),
        extension: isDirectory ? "" : extname(entry.name),
        kind: isDirectory ? "folder" : "file",
        name: entry.name,
        path: entryPath
      };
    }));

  return visibleEntries.sort(compareEntries);
}

async function loadGitIgnoreRules(parentPath: string): Promise<GitIgnoreRule[]> {
  let gitIgnoreContent = "";

  try {
    gitIgnoreContent = await readFile(resolve(parentPath, ".gitignore"), "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return gitIgnoreContent
    .split(/\r?\n/u)
    .map(parseGitIgnoreRule)
    .filter((rule): rule is GitIgnoreRule => rule !== null);
}

function parseGitIgnoreRule(line: string): GitIgnoreRule | null {
  let pattern = line.trim();

  if (!pattern || pattern.startsWith("#")) {
    return null;
  }

  if (pattern.startsWith("\\#") || pattern.startsWith("\\!")) {
    pattern = pattern.slice(1);
  }

  const ignored = !pattern.startsWith("!");
  pattern = ignored ? pattern : pattern.slice(1);

  if (!pattern) {
    return null;
  }

  if (pattern.startsWith("/")) {
    pattern = pattern.slice(1);
  }

  const directoryOnly = pattern.endsWith("/");
  pattern = directoryOnly ? pattern.slice(0, -1) : pattern;

  if (!pattern) {
    return null;
  }

  return {
    directoryOnly,
    hasSlash: pattern.includes("/"),
    ignored,
    pattern,
    regex: createGitIgnorePatternRegex(pattern)
  };
}

function isIgnoredByGitIgnoreRules(
  relativeEntryPath: string,
  name: string,
  isDirectory: boolean,
  rules: readonly GitIgnoreRule[]
): boolean {
  let ignored = false;

  for (const rule of rules) {
    if (rule.directoryOnly && !isDirectory) {
      continue;
    }

    const target = rule.hasSlash ? relativeEntryPath : name;

    if (rule.regex.test(target)) {
      ignored = rule.ignored;
    }
  }

  return ignored;
}

function createGitIgnorePatternRegex(pattern: string): RegExp {
  let source = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index] ?? "";
    const nextCharacter = pattern[index + 1];

    if (character === "*" && nextCharacter === "*") {
      source += ".*";
      index += 1;
      continue;
    }

    if (character === "*") {
      source += "[^/]*";
      continue;
    }

    if (character === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegexCharacter(character);
  }

  return new RegExp(`^${source}$`, "u");
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/gu, "/");
}

function escapeRegexCharacter(character: string): string {
  return character.replace(/[|\\{}()[\]^$+*?.]/gu, "\\$&");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function compareEntries(left: FileSystemEntry, right: FileSystemEntry): number {
  if (left.kind !== right.kind) {
    return left.kind === "folder" ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}
