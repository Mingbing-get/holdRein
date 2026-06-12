type ShellCommandRisk = "safe" | "writes" | "dangerous";

const DANGEROUS_PATTERNS = [
  /\brm\s+(-[^\s]*r[^\s]*f|-{1,2}recursive\b.*-{1,2}force\b)/u,
  /\bgit\s+reset\s+--hard\b/u,
  /\bsudo\b/u,
  /\bchmod\s+777\b/u
];

const WRITE_PATTERNS = [
  />/u,
  /\bmv\b/u,
  /\bcp\b/u,
  /\btouch\b/u,
  /\bmkdir\b/u,
  /\bgit\s+(add|commit|push|switch|checkout|branch)\b/u,
  /\b(pnpm|npm|yarn)\s+(install|add|remove)\b/u
];

export function classifyShellCommandRisk(command: string): ShellCommandRisk {
  if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))) {
    return "dangerous";
  }

  if (WRITE_PATTERNS.some((pattern) => pattern.test(command))) {
    return "writes";
  }

  return "safe";
}
