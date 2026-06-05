export interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

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

export type FileSelectorSelectableType = "folder" | `.${string}`;
