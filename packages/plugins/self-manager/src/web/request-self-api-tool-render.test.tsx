// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { RequestSelfApiToolRender } from "./request-self-api-tool-render";

describe("RequestSelfApiToolRender", () => {
  it("renders the self-manager title with the requested path", () => {
    renderTool({
      method: "GET",
      path: "/api/v1/model-providers"
    });

    expect(screen.getByText("自我管理：/api/v1/model-providers")).toBeInTheDocument();
    expect(screen.getByText("details")).toBeInTheDocument();
  });

  it("falls back to the tool name when the path argument is not a string", () => {
    renderTool({
      method: "GET"
    });

    expect(screen.getByText("自我管理：requestSelfApi")).toBeInTheDocument();
  });
});

function renderTool(args: Record<string, unknown>) {
  const DefaultToolRender = ({
    children,
    title
  }: WebPlugin.DefaultToolRenderProps) => (
    React.createElement("section", null, title, children)
  );

  return render(
    React.createElement(RequestSelfApiToolRender, {
      DefaultToolRender,
      renderDefaultChildren: () => React.createElement("span", null, "details"),
      toolCall: {
        arguments: args,
        id: "tool-call-1",
        name: "requestSelfApi",
        type: "toolCall"
      }
    })
  );
}
