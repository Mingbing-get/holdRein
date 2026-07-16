export type SelfApiMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export const BLOCKED_SELF_API_ROUTE_PATTERNS = [
  "/agents/start",
  "/agents/tasks/:taskId/messages",
  "/agents/tasks/:taskId/continue",
  "/agents/tasks/:taskId/interrupt",
  "/agents/tasks/:taskId/title",
  "/agents/:agentId/events",
  "/agents/:agentId/approvals/:approvalId",
  "/agents/:agentId/browser-tools/:toolCallId/result",
  "/file-system",
  "/file-system/*",
  "/health"
] as const;

export function isSelfApiPathAllowed(path: string): boolean {
  const normalized = normalizeSelfApiPath(path);
  if (normalized === null) return false;
  const routePath = normalized.slice("/api/v1".length) || "/";

  return !BLOCKED_SELF_API_ROUTE_PATTERNS.some((pattern) =>
    doesPathMatchPattern(routePath, pattern)
  );
}

export function normalizeSelfApiPath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("://")) return null;

  const [pathname] = path.split("?");
  if (!pathname || pathname.includes("..")) return null;

  return pathname === "/api/v1" || pathname.startsWith("/api/v1/")
    ? pathname
    : null;
}

function doesPathMatchPattern(path: string, pattern: string): boolean {
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return path === prefix || path.startsWith(`${prefix}/`);
  }

  const pathParts = path.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return false;

  return patternParts.every((part, index) =>
    part.startsWith(":") || part === pathParts[index]
  );
}
