import { describe, expect, it } from "vitest";

import { runCli } from "./index";

const collectOutput = (): {
  readonly lines: string[];
  readonly write: (value: string) => void;
} => {
  const lines: string[] = [];

  return {
    lines,
    write: (value: string): void => {
      lines.push(value);
    }
  };
};

describe("runCli", () => {
  it("prints the package version for the version command", () => {
    const output = collectOutput();

    const result = runCli(["version"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines).toEqual(["1.2.3\n"]);
  });

  it("prints the package version for the version flag", () => {
    const output = collectOutput();

    const result = runCli(["--version"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines).toEqual(["1.2.3\n"]);
  });

  it("prints help for the help command", () => {
    const output = collectOutput();

    const result = runCli(["help"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines.join("")).toContain("Usage: hold-rein <command>");
    expect(output.lines.join("")).toContain("Aliases: hold-rein, hr");
    expect(output.lines.join("")).toContain("version");
    expect(output.lines.join("")).toContain("help");
  });

  it("prints help for the help flag", () => {
    const output = collectOutput();

    const result = runCli(["--help"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines.join("")).toContain("Usage: hold-rein <command>");
  });
});
