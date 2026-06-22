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

interface WorkspaceSkill {
  name: string;
  path: string;
}

interface WorkspaceSkillsResponse {
  skills: WorkspaceSkill[];
}

export function useWorkspaceFileSuggestions(
  apiBaseUrl: string,
  taskStatus: TaskStatus
): WebPlugin.SuggestionGroup[] {
  const {
    state: { activeWorkspaceId, workspaces }
  } = useAppWorkspace();
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [skills, setSkills] = useState<WorkspaceSkill[]>([]);
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
      setSkills((currentSkills) =>
        currentSkills.length ? [] : currentSkills
      );
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const [listing, skillListing] = await Promise.all([
        fetchWorkspaceEntriesRecursive(apiBaseUrl, workspacePath),
        fetchWorkspaceSkills(apiBaseUrl, workspacePath)
      ]);

      if (requestIdRef.current === requestId) {
        setEntries((currentEntries) =>
          areEntriesEqual(currentEntries, listing.entries)
            ? currentEntries
            : listing.entries
        );
        setSkills((currentSkills) =>
          areSkillsEqual(currentSkills, skillListing.skills)
            ? currentSkills
            : skillListing.skills
        );
      }
    } catch {
      if (requestIdRef.current === requestId) {
        setEntries((currentEntries) =>
          currentEntries.length ? [] : currentEntries
        );
        setSkills((currentSkills) =>
          currentSkills.length ? [] : currentSkills
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

async function fetchWorkspaceSkills(
  apiBaseUrl: string,
  workspacePath: string
): Promise<WorkspaceSkillsResponse> {
  const response = await fetch(createWorkspaceSkillsUrl(apiBaseUrl, workspacePath));

  if (!response.ok) {
    throw new Error("Failed to load workspace skill suggestions");
  }

  const payload = (await response.json()) as ApiResponse<WorkspaceSkillsResponse>;

  if (!payload.data || !Array.isArray(payload.data.skills)) {
    return {
      skills: []
    };
  }

  return payload.data;
}

function createWorkspaceSkillsUrl(apiBaseUrl: string, workspacePath: string): string {
  const baseUrl = apiBaseUrl.replace(/\/$/, "");
  const query = new URLSearchParams({ workspacePath });

  return `${baseUrl}/api/v1/agents/skills?${query.toString()}`;
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

function createSkillSuggestion(skill: WorkspaceSkill): WebPlugin.SuggestionItem {
  return {
    label: skill.name,
    value: `使用技能[${skill.name}]`
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
      leftEntry.path === rightEntry.path &&
      areEntriesEqual(leftEntry.children ?? [], rightEntry.children ?? [])
    );
  });
}

function areSkillsEqual(
  leftSkills: WorkspaceSkill[],
  rightSkills: WorkspaceSkill[]
): boolean {
  if (leftSkills.length !== rightSkills.length) {
    return false;
  }

  return leftSkills.every((leftSkill, index) => {
    const rightSkill = rightSkills[index];

    return (
      rightSkill !== undefined &&
      leftSkill.name === rightSkill.name &&
      leftSkill.path === rightSkill.path
    );
  });
}
