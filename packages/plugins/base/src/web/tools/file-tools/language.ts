const languageByExtension: Readonly<Record<string, string>> = {
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  go: "go",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  py: "python",
  rs: "rust",
  sh: "shell",
  sql: "sql",
  ts: "typescript",
  tsx: "typescript",
  txt: "plaintext",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml"
};

export function getLanguageFromPath(path: string | undefined): string {
  if (!path) {
    return "plaintext";
  }

  const extension = path.split(".").pop()?.toLowerCase();
  return extension ? languageByExtension[extension] ?? "plaintext" : "plaintext";
}
