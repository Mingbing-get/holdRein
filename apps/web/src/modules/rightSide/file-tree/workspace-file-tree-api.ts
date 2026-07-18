import { request } from "../../../api/request";
import type {
  FileSystemDirectoryListing,
  FileSystemEntry
} from "../../../components/fileSelector";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";

export interface FileSystemFileContent {
  content: string;
  filePath: string;
}

export async function fetchDirectoryEntries(
  parentPath: string
): Promise<FileSystemDirectoryListing> {
  const result = await request<FileSystemDirectoryListing>({
    method: "GET",
    path: "/api/v1/file-system/entries",
    query: { parentPath }
  });

  return normalizeDirectoryListing(result.data, parentPath);
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

export async function createDirectory(
  parentPath: string,
  name: string
): Promise<FileSystemEntry> {
  const result = await request<FileSystemEntry>({
    body: JSON.stringify({ name, parentPath }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST",
    path: "/api/v1/file-system/folders"
  });

  return normalizeEntry(result.data);
}

export async function deleteFileSystemEntry(
  entryPath: string
): Promise<FileSystemEntry> {
  const result = await request<FileSystemEntry>({
    method: "DELETE",
    path: "/api/v1/file-system/entries",
    query: { entryPath }
  });

  return normalizeEntry(result.data);
}

export async function uploadFilesToDirectory(
  parentPath: string,
  files: readonly File[]
): Promise<FileSystemEntry[]> {
  const body = new FormData();

  for (const file of files) {
    body.append("files", file);
  }

  const result = await request<FileSystemEntry[]>({
    body,
    method: "POST",
    path: "/api/v1/file-system/files",
    query: { parentPath }
  });

  return result.data.map(normalizeEntry);
}

export async function downloadFile(filePath: string): Promise<void> {
  const response = await fetch(createDownloadFileUrl(filePath), {
    body: undefined,
    headers: undefined,
    method: "GET"
  } as unknown as RequestInit);

  if (!response.ok) {
    throw new Error("Failed to download file");
  }

  if (typeof response.blob !== "function") {
    return;
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filePath.split("/").pop() || "download";
  link.click();
  URL.revokeObjectURL(downloadUrl);
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

function createDownloadFileUrl(filePath: string): string {
  const baseUrl = apiBaseUrl.replace(/\/$/, "");

  return `${baseUrl}/api/v1/file-system/files/download?filePath=${encodeURIComponent(filePath)}`;
}
