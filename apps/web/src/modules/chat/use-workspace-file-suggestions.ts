import type { WebPlugin } from "@hold-rein/plugin-web";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppWorkspace } from "../../app/app-workspace-context";
import type {
  ApiResponse,
  FileSystemDirectoryListing,
  FileSystemEntry
} from "../../components/fileSelector/file-selector-types";
import type { AgentTaskState } from "../agent-messages";

type TaskStatus = AgentTaskState["status"] | undefined;

export function useWorkspaceFileSuggestions(
  apiBaseUrl: string,
  taskStatus: TaskStatus
): WebPlugin.SuggestionGroup[] {
  const {
    state: { activeWorkspaceId, workspaces }
  } = useAppWorkspace();
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [activeWorkspaceId, workspaces]
  );
  const requestIdRef = useRef(0);
  const previousTaskStatusRef = useRef<TaskStatus>(taskStatus);

  const refreshEntries = useCallback(async () => {
    const workspacePath = activeWorkspace?.path;

    if (!workspacePath) {
      setEntries((currentEntries) =>
        currentEntries.length ? [] : currentEntries
      );
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const listing = await fetchWorkspaceEntriesRecursive(
        apiBaseUrl,
        workspacePath
      );

      if (requestIdRef.current === requestId) {
        setEntries((currentEntries) =>
          areEntriesEqual(currentEntries, listing.entries)
            ? currentEntries
            : listing.entries
        );
      }
    } catch {
      if (requestIdRef.current === requestId) {
        setEntries((currentEntries) =>
          currentEntries.length ? [] : currentEntries
        );
      }
    }
  }, [activeWorkspace?.path, apiBaseUrl]);

  useEffect(() => {
    void refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    const previousTaskStatus = previousTaskStatusRef.current;
    previousTaskStatusRef.current = taskStatus;

    if (previousTaskStatus === "running" && taskStatus !== "running") {
      void refreshEntries();
    }
  }, [refreshEntries, taskStatus]);

  return useMemo(() => {
    const workspacePath = activeWorkspace?.path;

    if (!workspacePath || !entries.length) {
      return [];
    }

    return [
      {
        trigger: "/",
        suggestions: entries.map((entry) =>
          createFileSuggestion(entry, workspacePath)
        )
      }
    ];
  }, [activeWorkspace?.path, entries]);
}

async function fetchWorkspaceEntriesRecursive(
  apiBaseUrl: string,
  parentPath: string
): Promise<FileSystemDirectoryListing> {
  const response = await fetch(
    createWorkspaceEntriesRecursiveUrl(apiBaseUrl, parentPath)
  );

  if (!response.ok) {
    throw new Error("Failed to load workspace file suggestions");
  }

  const payload = (await response.json()) as ApiResponse<FileSystemDirectoryListing>;

  if (!payload.data || !Array.isArray(payload.data.entries)) {
    return {
      entries: [],
      parentPath
    };
  }

  return payload.data;
}

function createWorkspaceEntriesRecursiveUrl(
  apiBaseUrl: string,
  parentPath: string
): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/file-system/entries/recursive?parentPath=${encodeURIComponent(parentPath)}`;
}

function createFileSuggestion(
  entry: FileSystemEntry,
  workspacePath: string
): WebPlugin.SuggestionItem {
  const relativePath = getRelativeWorkspacePath(workspacePath, entry.path);
  const suggestionPath =
    entry.kind === "folder" ? `${relativePath}/` : relativePath;

  return {
    label: suggestionPath,
    value: `/${suggestionPath}`
  };
}

function getRelativeWorkspacePath(workspacePath: string, entryPath: string): string {
  const normalizedWorkspacePath = stripTrailingSeparators(workspacePath);
  const normalizedEntryPath = stripTrailingSeparators(entryPath);
  const workspacePrefix = `${normalizedWorkspacePath}/`;

  if (normalizedEntryPath.startsWith(workspacePrefix)) {
    return normalizedEntryPath.slice(workspacePrefix.length);
  }

  return normalizedEntryPath;
}

function stripTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/u, "");
}

function areEntriesEqual(
  leftEntries: FileSystemEntry[],
  rightEntries: FileSystemEntry[]
): boolean {
  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every((leftEntry, index) => {
    const rightEntry = rightEntries[index];

    if (!rightEntry) {
      return false;
    }

    return (
      leftEntry.extension === rightEntry.extension &&
      leftEntry.kind === rightEntry.kind &&
      leftEntry.name === rightEntry.name &&
      leftEntry.path === rightEntry.path
    );
  });
}
