// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { describe, expect, it } from "vitest";

import {
  shellExecTool,
  shellKillTool,
  shellReadTool
} from ".";

const expectedTitles = [
  [shellExecTool, "执行命令"],
  [shellReadTool, "读取命令输出"],
  [shellKillTool, "终止命令"]
] as const;

describe("shell tool renders", () => {
  it.each(expectedTitles)(
    "renders the configured title for $toolName",
    (toolRender, expectedTitle) => {
      const DefaultToolRender = ({
        children,
        title
      }: WebPlugin.DefaultToolRenderProps) => (
        React.createElement("section", null, title, children)
      );

      render(React.createElement(toolRender.Render, {
        DefaultToolRender,
        renderDefaultChildren: () => React.createElement("span", null, "details"),
        toolCall: {
          arguments: {},
          id: "tool-call-1",
          name: toolRender.toolName
        }
      }));

      expect(screen.getByText(expectedTitle)).toBeInTheDocument();
      expect(screen.getByText("details")).toBeInTheDocument();
    }
  );
});
