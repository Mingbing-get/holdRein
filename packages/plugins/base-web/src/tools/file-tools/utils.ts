import { useEffect, useState } from "react";
import type { WebPlugin } from "@hold-rein/plugin-web";

export function getStringArg(
  args: Record<string, unknown>,
  key: string
): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

export function getTextResult(result: WebPlugin.ToolResultMessage | undefined): string {
  if (!result) {
    return "";
  }

  return result.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

export function splitResultLines(text: string): string[] {
  return text.split(/\r?\n/).filter(Boolean);
}

export function useMonacoTheme(): "vs" | "vs-dark" {
  const [theme, setTheme] = useState<"vs" | "vs-dark">(() =>
    document.documentElement.dataset.themeMode === "dark" ? "vs-dark" : "vs"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(
        document.documentElement.dataset.themeMode === "dark" ? "vs-dark" : "vs"
      );
    });

    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme-mode"]
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return theme;
}
