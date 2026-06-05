import type {
  ApiResponse,
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
