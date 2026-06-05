import { Router, type Request, type Response } from "express";

import { sendError, sendSuccess } from "../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../response/response-codes";
import { listDirectoryEntries } from "./file-system-service";

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

  return router;
}

function getParentPath(parentPath: Request["query"][string]): string | undefined | null {
  if (parentPath === undefined) {
    return undefined;
  }

  return typeof parentPath === "string" ? parentPath : null;
}
