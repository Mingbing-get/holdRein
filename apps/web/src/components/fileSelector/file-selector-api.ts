import type {
  ApiResponse,
  FileSystemEntry,
  FileSystemDirectoryListing
} from "./file-selector-types";

export async function fetchFileSystemEntries(
  apiBaseUrl: string,
  parentPath?: string
): Promise<FileSystemDirectoryListing> {
  const response = await fetch(createFileSystemEntriesUrl(apiBaseUrl, parentPath));

  if (!response.ok) {
    throw new Error("Failed to load directory entries");
  }

  const payload = (await response.json()) as ApiResponse<FileSystemDirectoryListing>;

  return payload.data;
}

export async function createFileSystemFolder(
  apiBaseUrl: string,
  parentPath: string,
  name: string
): Promise<FileSystemEntry> {
  const response = await fetch(createFileSystemFolderUrl(apiBaseUrl), {
    body: JSON.stringify({ name, parentPath }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to create folder");
  }

  const payload = (await response.json()) as ApiResponse<FileSystemEntry>;

  return payload.data;
}

export async function deleteFileSystemEntry(
  apiBaseUrl: string,
  entryPath: string
): Promise<FileSystemEntry> {
  const response = await fetch(createFileSystemEntryUrl(apiBaseUrl, entryPath), {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Failed to delete file-system entry");
  }

  const payload = (await response.json()) as ApiResponse<FileSystemEntry>;

  return payload.data;
}

export function createFileSystemEntriesUrl(
  apiBaseUrl: string,
  parentPath?: string
): string {
  const url = `${apiBaseUrl.replace(/\/$/, "")}/api/v1/file-system/entries`;

  if (!parentPath) {
    return url;
  }

  return `${url}?parentPath=${encodeURIComponent(parentPath)}`;
}

export function createFileSystemFolderUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/file-system/folders`;
}

export function createFileSystemEntryUrl(
  apiBaseUrl: string,
  entryPath: string
): string {
  const url = `${apiBaseUrl.replace(/\/$/, "")}/api/v1/file-system/entries`;

  return `${url}?entryPath=${encodeURIComponent(entryPath)}`;
}
