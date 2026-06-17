import { request } from "../../../api/request";
import type {
  FileSystemDirectoryListing,
  FileSystemEntry
} from "../../../components/fileSelector";

export interface FileSystemFileContent {
  content: string;
  filePath: string;
}

export async function fetchWorkspaceEntriesRecursive(
  workspacePath: string
): Promise<FileSystemDirectoryListing> {
  const result = await request<FileSystemDirectoryListing>({
    method: "GET",
    path: "/api/v1/file-system/entries/recursive",
    query: {
      ignores: "node_modules",
      parentPath: workspacePath,
      useGitIgnore: true
    }
  });

  return normalizeDirectoryListing(result.data, workspacePath);
}

export async function fetchFileContent(
  filePath: string
): Promise<FileSystemFileContent> {
  const result = await request<FileSystemFileContent>({
    method: "GET",
    path: "/api/v1/file-system/file-content",
    query: { filePath }
  });

  return result.data;
}

function normalizeDirectoryListing(
  listing: FileSystemDirectoryListing | undefined,
  workspacePath: string
): FileSystemDirectoryListing {
  if (!listing || !Array.isArray(listing.entries)) {
    return {
      entries: [],
      parentPath: workspacePath
    };
  }

  return {
    entries: listing.entries.map(normalizeEntry),
    parentPath: listing.parentPath || workspacePath
  };
}

function normalizeEntry(entry: FileSystemEntry): FileSystemEntry {
  return {
    ...entry,
    ...(entry.children ? { children: entry.children.map(normalizeEntry) } : {})
  };
}
