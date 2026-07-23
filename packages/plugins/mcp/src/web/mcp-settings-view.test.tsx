// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "../plugin-id";
import webPlugin from "../web";
import { McpSettingsView } from "./mcp-settings-view";
import type { McpServerConfigSummary } from "./mcp-settings-types";

describe("mcp settings web contribution", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
  });

  afterEach(() => {
    cleanup();
  });

  it("contributes the MCP settings item", async () => {
    const contribution = await resolveContribution();

    expect(contribution.settings).toEqual([
      expect.objectContaining({
        id: "settings",
        title: "MCP 配置"
      })
    ]);
  });

  it("loads servers and masks existing secrets", async () => {
    renderView({
      servers: [
        createServer({
          env: { TOKEN: "********" },
          id: "local",
          name: "Local"
        })
      ]
    });

    expect(await screen.findByText("Local")).toBeInTheDocument();
    expect(screen.getByText("stdio")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edit Local/ }));

    expect(screen.getByLabelText("Env")).toHaveValue("TOKEN=********");
  });

  it("saves a new server from the modal", async () => {
    const request = renderView({ servers: [] });

    fireEvent.click(await screen.findByRole("button", { name: /New server/ }));

    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Local" }
    });
    fireEvent.change(screen.getByLabelText("Command"), {
      target: { value: "node" }
    });
    fireEvent.change(screen.getByLabelText("Env"), {
      target: { value: "TOKEN=secret" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() => {
      const call = request.mock.calls.find(
        ([options]) => options.method === "PUT"
      );
      expect(call?.[0]).toMatchObject({
        method: "PUT",
        path: `/plugin/${PLUGIN_ID}/servers/local`
      });
      expect(JSON.parse(String(call?.[0].body))).toMatchObject({
        command: "node",
        env: { TOKEN: "secret" },
        name: "Local",
        transport: "stdio"
      });
    });
  });

  it("renders the empty state outside of the server card grid", async () => {
    renderView({ servers: [] });

    const emptyState = await screen.findByText("No MCP servers");
    const listContainer = emptyState.closest("[aria-busy]");

    expect(emptyState).toBeInTheDocument();
    expect(listContainer).not.toHaveStyle({ display: "grid" });
    expect(screen.queryByTestId("mcp-server-grid")).not.toBeInTheDocument();
  });

  it("requires confirmation before deleting a server", async () => {
    const request = renderView({
      servers: [createServer({ id: "local", name: "Local" })]
    });

    await screen.findByText("Local");
    fireEvent.click(screen.getByRole("button", { name: /Delete Local/ }));

    expect(
      request.mock.calls.some(([options]) => options.method === "DELETE")
    ).toBe(false);
    expect(await screen.findByText("确认删除 MCP 配置？")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Confirm delete Local/ })
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        method: "DELETE",
        path: `/plugin/${PLUGIN_ID}/servers/local`
      });
    });
  });

  it("switches between stdio and http transport fields", async () => {
    renderView({ servers: [] });

    fireEvent.click(await screen.findByRole("button", { name: /New server/ }));
    expect(await screen.findByLabelText("Command")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "HTTP" }));

    await waitFor(() => {
      expect(screen.getByLabelText("URL")).toBeInTheDocument();
      expect(screen.queryByLabelText("Command")).not.toBeInTheDocument();
    });
  });

  it("switches to SSE transport fields", async () => {
    renderView({ servers: [] });

    fireEvent.click(await screen.findByRole("button", { name: /New server/ }));
    fireEvent.click(screen.getByRole("radio", { name: "SSE" }));

    await waitFor(() => {
      expect(screen.getByLabelText("URL")).toBeInTheDocument();
      expect(screen.getByLabelText("Headers")).toBeInTheDocument();
      expect(screen.queryByLabelText("Command")).not.toBeInTheDocument();
    });
  });
});

function renderView(options: {
  readonly servers: readonly McpServerConfigSummary[];
}): ReturnType<typeof vi.fn> {
  const request = vi.fn(async ({ body, method = "GET", path }) => {
    if (method === "GET") {
      return { code: 0, data: options.servers, msg: "success" };
    }

    if (method === "PUT") {
      const id = String(path).split("/").at(-1) ?? "local";
      const parsed = JSON.parse(String(body));
      return {
        code: 0,
        data: createServer({ ...parsed, id }),
        msg: "success"
      };
    }

    return { code: 0, data: null, msg: "success" };
  });

  render(<McpSettingsView request={request as WebPlugin.RuntimeContext["request"]} />);
  return request;
}

async function resolveContribution(): Promise<WebPlugin.Contribution> {
  if (!webPlugin.contributionResolver) {
    throw new Error("Expected MCP web contribution resolver");
  }

  const context: WebPlugin.RuntimeContext = {
    request: vi.fn(),
    subscribeAppUi: vi.fn()
  };
  const resolver = webPlugin.contributionResolver;
  return typeof resolver === "function" ? resolver(context) : resolver;
}

function createServer(
  overrides: Partial<McpServerConfigSummary> = {}
): McpServerConfigSummary {
  return {
    args: [],
    command: "node",
    enabled: true,
    env: {},
    headers: {},
    id: "local",
    name: "Local",
    transport: "stdio",
    ...overrides
  };
}

class ResizeObserverMock {
  disconnect() {
    return undefined;
  }

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }
}

function createMatchMediaMock(): typeof window.matchMedia {
  return ((query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined
  })) as typeof window.matchMedia;
}
