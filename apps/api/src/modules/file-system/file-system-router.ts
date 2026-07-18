import express, { Router, type Request, type Response } from "express";

import { sendError, sendSuccess } from "../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../response/response-codes";
import {
  createFolder,
  deleteEntry,
  getFileDownload,
  listDirectoryEntries,
  listDirectoryEntriesRecursive,
  readFileContent,
  uploadFiles,
  type UploadFileInput
} from "./file-system-service";

export interface CreateFileSystemRouterOptions {
  fileSystemRootPath?: string;
}

export function createFileSystemRouter(
  options: CreateFileSystemRouterOptions = {}
): Router {
  const router = Router();

  router.get(
    "/file-system/entries",
    (request: Request, response: Response): void => {
      const parentPath = getParentPath(request.query.parentPath);

      if (parentPath === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "parentPath must be a string"
        );
        return;
      }

      const listOptions = {
        ...(parentPath === undefined ? {} : { parentPath }),
        ...(options.fileSystemRootPath === undefined
          ? {}
          : { rootPath: options.fileSystemRootPath })
      };

      void listDirectoryEntries(listOptions)
        .then((listing) => {
          sendSuccess(response, listing);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error
              ? error.message
              : "Failed to list directory entries"
          );
        });
    }
  );

  router.post(
    "/file-system/folders",
    (request: Request, response: Response): void => {
      const parentPath = getOptionalBodyString(request.body?.parentPath);
      const name = getRequiredBodyString(request.body?.name);

      if (parentPath === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "parentPath must be a string"
        );
        return;
      }

      if (name === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "name must be a string"
        );
        return;
      }

      const createOptions = {
        name,
        ...(parentPath === undefined ? {} : { parentPath }),
        ...(options.fileSystemRootPath === undefined
          ? {}
          : { rootPath: options.fileSystemRootPath })
      };

      void createFolder(createOptions)
        .then((entry) => {
          sendSuccess(response, entry);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to create folder"
          );
        });
    }
  );

  router.post(
    "/file-system/files",
    expressRawBody,
    (request: Request, response: Response): void => {
      const parentPath = getParentPath(request.query.parentPath);

      if (parentPath === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "parentPath must be a string"
        );
        return;
      }

      let files: UploadFileInput[];

      try {
        files = parseMultipartFiles(request.headers["content-type"], request.body);
      } catch (error) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          error instanceof Error ? error.message : "Failed to parse uploaded files"
        );
        return;
      }

      const uploadOptions = {
        files,
        ...(parentPath === undefined ? {} : { parentPath }),
        ...(options.fileSystemRootPath === undefined
          ? {}
          : { rootPath: options.fileSystemRootPath })
      };

      void uploadFiles(uploadOptions)
        .then((entries) => {
          sendSuccess(response, entries);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to upload files"
          );
        });
    }
  );

  router.delete(
    "/file-system/entries",
    (request: Request, response: Response): void => {
      const entryPath = getRequiredQueryString(request.query.entryPath);

      if (entryPath === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "entryPath must be a string"
        );
        return;
      }

      const deleteOptions = {
        entryPath,
        ...(options.fileSystemRootPath === undefined
          ? {}
          : { rootPath: options.fileSystemRootPath })
      };

      void deleteEntry(deleteOptions)
        .then((entry) => {
          sendSuccess(response, entry);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error
              ? error.message
              : "Failed to delete file-system entry"
          );
        });
    }
  );

  router.get(
    "/file-system/entries/recursive",
    (request: Request, response: Response): void => {
      const parentPath = getParentPath(request.query.parentPath);
      const ignores = getOptionalQueryStringArray(request.query.ignores);
      const useGitIgnore = getOptionalQueryBoolean(request.query.useGitIgnore);

      if (parentPath === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "parentPath must be a string"
        );
        return;
      }

      if (ignores === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "ignores must be a string array"
        );
        return;
      }

      if (useGitIgnore === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "useGitIgnore must be a boolean"
        );
        return;
      }

      const listOptions = {
        ...(ignores === undefined ? {} : { ignores }),
        ...(parentPath === undefined ? {} : { parentPath }),
        ...(useGitIgnore === undefined ? {} : { useGitIgnore }),
        ...(options.fileSystemRootPath === undefined
          ? {}
          : { rootPath: options.fileSystemRootPath })
      };

      void listDirectoryEntriesRecursive(listOptions)
        .then((listing) => {
          sendSuccess(response, listing);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error
              ? error.message
              : "Failed to list directory entries recursively"
          );
        });
    }
  );

  router.get(
    "/file-system/files/download",
    (request: Request, response: Response): void => {
      const filePath = getRequiredQueryString(request.query.filePath);

      if (filePath === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "filePath must be a string"
        );
        return;
      }

      const downloadOptions = {
        filePath,
        ...(options.fileSystemRootPath === undefined
          ? {}
          : { rootPath: options.fileSystemRootPath })
      };

      void getFileDownload(downloadOptions)
        .then((fileDownload) => {
          response.download(fileDownload.filePath, fileDownload.name);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to download file"
          );
        });
    }
  );

  router.get(
    "/file-system/file-content",
    (request: Request, response: Response): void => {
      const filePath = getRequiredQueryString(request.query.filePath);

      if (filePath === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "filePath must be a string"
        );
        return;
      }

      const readOptions = {
        filePath,
        ...(options.fileSystemRootPath === undefined
          ? {}
          : { rootPath: options.fileSystemRootPath })
      };

      void readFileContent(readOptions)
        .then((fileContent) => {
          sendSuccess(response, fileContent);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error
              ? error.message
              : "Failed to read file content"
          );
        });
    }
  );

  return router;
}

const expressRawBody = express.raw({
  limit: "100mb",
  type: () => true
});

function parseMultipartFiles(
  contentType: string | string[] | undefined,
  body: unknown
): UploadFileInput[] {
  const header = Array.isArray(contentType) ? contentType[0] : contentType;
  const boundary = getMultipartBoundary(header);

  if (!boundary) {
    throw new Error("multipart boundary is required");
  }

  if (!Buffer.isBuffer(body)) {
    throw new Error("multipart body is required");
  }

  return splitBuffer(body, Buffer.from(`--${boundary}`))
    .map(parseMultipartFilePart)
    .filter((file): file is UploadFileInput => file !== null);
}

function getMultipartBoundary(contentType: string | undefined): string | null {
  if (!contentType?.startsWith("multipart/form-data")) {
    return null;
  }

  const boundary = contentType
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("boundary="));

  return boundary ? boundary.slice("boundary=".length) : null;
}

function parseMultipartFilePart(part: Buffer): UploadFileInput | null {
  const trimmedPart = trimMultipartBoundaryPart(part);

  if (trimmedPart.length === 0 || trimmedPart.equals(Buffer.from("--"))) {
    return null;
  }

  const headerSeparatorIndex = trimmedPart.indexOf("\r\n\r\n");

  if (headerSeparatorIndex === -1) {
    return null;
  }

  const header = trimmedPart.subarray(0, headerSeparatorIndex).toString("utf8");
  const name = getMultipartFilename(header);

  if (!name) {
    return null;
  }

  return {
    content: trimTrailingCrLf(trimmedPart.subarray(headerSeparatorIndex + 4)),
    name
  };
}

function getMultipartFilename(header: string): string | null {
  const match = /filename="([^"]+)"/u.exec(header);

  return match?.[1] ?? null;
}

function trimMultipartBoundaryPart(part: Buffer): Buffer {
  let trimmedPart = part;

  if (trimmedPart.subarray(0, 2).equals(Buffer.from("\r\n"))) {
    trimmedPart = trimmedPart.subarray(2);
  }

  return trimTrailingCrLf(trimmedPart);
}

function trimTrailingCrLf(buffer: Buffer): Buffer {
  return buffer.subarray(-2).equals(Buffer.from("\r\n"))
    ? buffer.subarray(0, -2)
    : buffer;
}

function splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let startIndex = 0;
  let delimiterIndex = buffer.indexOf(delimiter, startIndex);

  while (delimiterIndex !== -1) {
    parts.push(buffer.subarray(startIndex, delimiterIndex));
    startIndex = delimiterIndex + delimiter.length;
    delimiterIndex = buffer.indexOf(delimiter, startIndex);
  }

  parts.push(buffer.subarray(startIndex));

  return parts;
}

function getParentPath(parentPath: Request["query"][string]): string | undefined | null {
  if (parentPath === undefined) {
    return undefined;
  }

  return typeof parentPath === "string" ? parentPath : null;
}

function getRequiredQueryString(value: Request["query"][string]): string | null {
  return typeof value === "string" ? value : null;
}

function getRequiredBodyString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getOptionalBodyString(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "string" ? value : null;
}

function getOptionalQueryStringArray(
  value: Request["query"][string]
): string[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }

  return null;
}

function getOptionalQueryBoolean(
  value: Request["query"][string]
): boolean | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}
