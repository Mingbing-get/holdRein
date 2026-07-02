import type { WebPlugin } from "@hold-rein/plugin-web";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppWorkspace } from "../../app/app-workspace-context";
import type {
  ApiResponse,
  FileSystemDirectoryListing,
  FileSystemEntry
} from "../../components/fileSelector/file-selector-types";
import type { AgentTaskState } from "../agent-messages";
import { fetchWorkspaceSetting } from "../leftSide/workspace-nav-api";
import type { WorkspaceSkillSettingOption } from "../leftSide/workspace-nav-types";

type TaskStatus = AgentTaskState["status"] | undefined;

export function useWorkspaceFileSuggestions(
  apiBaseUrl: string,
  taskStatus: TaskStatus
): WebPlugin.SuggestionGroup[] {
  const {
    setWorkspaceSetting,
    state: { activeWorkspaceId, workspaceSettings, workspaces }
  } = useAppWorkspace();
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [activeWorkspaceId, workspaces]
  );
  const workspaceSetting = activeWorkspaceId
    ? workspaceSettings[activeWorkspaceId]
    : undefined;
  const skills = useMemo(
    () => getActiveSkills(workspaceSetting),
    [workspaceSetting]
  );
  const requestIdRef = useRef(0);
  const previousTaskStatusRef = useRef<TaskStatus>(taskStatus);

  const refreshEntries = useCallback(async () => {
    const workspacePath = activeWorkspace?.path;
    const workspaceId = activeWorkspace?.id;

    if (!workspacePath || !workspaceId) {
      setEntries((currentEntries) =>
        currentEntries.length ? [] : currentEntries
      );
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const [listing, setting] = await Promise.all([
        fetchWorkspaceEntriesRecursive(apiBaseUrl, workspacePath),
        fetchWorkspaceSetting(apiBaseUrl, workspaceId)
      ]);

      if (requestIdRef.current === requestId) {
        setEntries((currentEntries) =>
          areEntriesEqual(currentEntries, listing.entries)
            ? currentEntries
            : listing.entries
        );
        setWorkspaceSetting(setting);
      }
    } catch {
      if (requestIdRef.current === requestId) {
        setEntries((currentEntries) =>
          currentEntries.length ? [] : currentEntries
        );
      }
    }
  }, [
    activeWorkspace?.id,
    activeWorkspace?.path,
    apiBaseUrl,
    setWorkspaceSetting
  ]);

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

    if (!workspacePath || (!entries.length && !skills.length)) {
      return [];
    }

    const groups: WebPlugin.SuggestionGroup[] = [];

    if (entries.length) {
      groups.push({
        trigger: "/",
        title: '文件',
        suggestions: entries.map((entry) =>
          createFileSuggestion(entry, workspacePath, "")
        )
      });
    }

    if (skills.length) {
      groups.push({
        trigger: "/",
        title: "技能",
        suggestions: skills.map(createSkillSuggestion)
      });
    }

    return groups;
  }, [activeWorkspace?.path, entries, skills]);
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
  const baseUrl = apiBaseUrl.replace(/\/$/, "");
  const query = new URLSearchParams({
    parentPath,
    ignores: "node_modules",
    useGitIgnore: "true"
  });

  return `${baseUrl}/api/v1/file-system/entries/recursive?${query.toString()}`;
}

function createFileSuggestion(
  entry: FileSystemEntry,
  workspacePath: string,
  parentRelativePath: string
): WebPlugin.SuggestionItem {
  const relativePath = getRelativeWorkspacePath(workspacePath, entry.path);
  const suggestionLabel = entry.kind === "folder" ? `${entry.name}/` : entry.name;
  const suggestionPath = entry.kind === "folder" ? `${relativePath}/` : relativePath;
  const suggestionKind = entry.kind === "folder" ? "文件夹" : "文件";
  const children = entry.children?.map((childEntry) =>
    createFileSuggestion(childEntry, workspacePath, relativePath)
  );

  return {
    ...(children?.length ? { children } : {}),
    label: parentRelativePath ? suggestionLabel : suggestionPath,
    value: `${suggestionKind}[${suggestionPath}]`
  };
}

function createSkillSuggestion(
  skill: WorkspaceSkillSettingOption
): WebPlugin.SuggestionItem {
  return {
    label: skill.name,
    value: `使用技能[${skill.name}]`
  };
}

function getActiveSkills(
  workspaceSetting:
    | {
        setting: {
          activeSkills?: string[];
        };
        skillOptions: WorkspaceSkillSettingOption[];
      }
    | undefined
): WorkspaceSkillSettingOption[] {
  if (!workspaceSetting) {
    return [];
  }

  const activeSkills = workspaceSetting.setting.activeSkills;
  if (!activeSkills) {
    return workspaceSetting.skillOptions;
  }

  const activeSkillSet = new Set(activeSkills);

  return workspaceSetting.skillOptions.filter((skill) =>
    activeSkillSet.has(skill.id)
  );
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
      leftEntry.path === rightEntry.path &&
      areEntriesEqual(leftEntry.children ?? [], rightEntry.children ?? [])
    );
  });
}
