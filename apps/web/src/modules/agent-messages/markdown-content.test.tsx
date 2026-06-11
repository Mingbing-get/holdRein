// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownContent } from "./markdown-content";

describe("MarkdownContent", () => {
  afterEach(cleanup);

  it("renders Markdown and GitHub-flavored tables", () => {
    render(
      <MarkdownContent>
        {"## Result\n\n| Name | Value |\n| --- | --- |\n| Build | Pass |"}
      </MarkdownContent>
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Result" })
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("does not render raw HTML", () => {
    const { container } = render(
      <MarkdownContent>
        {"<script>window.markdownExecuted = true</script>"}
      </MarkdownContent>
    );

    expect(container.querySelector("script")).not.toBeInTheDocument();
  });
});
