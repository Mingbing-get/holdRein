import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const agentsService = { startAgent: vi.fn() };
  const scheduledService = { start: vi.fn() };

  return {
    agentsService,
    scheduledService,
    bootstrapServerPlugins: vi.fn().mockResolvedValue(undefined),
    createApp: vi.fn().mockResolvedValue({
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        const server = new EventEmitter();
        queueMicrotask(callback);
        return server;
      })
    }),
    getDefaultAgentsService: vi.fn(() => agentsService),
    getDefaultScheduledTasksService: vi.fn(() => scheduledService),
    loadApiEnv: vi.fn(),
    getApiEnv: vi.fn(() => ({ pluginRoot: "/tmp/plugins" })),
    devPluginManager: {
      close: vi.fn(),
      getServerPluginEntries: vi.fn(() => []),
      getWebPluginManifests: vi.fn(() => [])
    },
    startDevPluginManager: vi.fn()
  };
});

vi.mock("./app", () => ({ createApp: mocks.createApp }));
vi.mock("./config/env", () => ({
  getApiEnv: mocks.getApiEnv,
  loadApiEnv: mocks.loadApiEnv
}));
vi.mock("./modules/agents", () => ({
  getDefaultAgentsService: mocks.getDefaultAgentsService
}));
vi.mock("./modules/scheduled-tasks", () => ({
  getDefaultScheduledTasksService: mocks.getDefaultScheduledTasksService
}));
vi.mock("./plugin", () => ({
  bootstrapServerPlugins: mocks.bootstrapServerPlugins
}));
vi.mock("@hold-rein/plugin-server", () => ({
  startDevPluginManager: mocks.startDevPluginManager
}));

describe("runtime startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts scheduled tasks after creating the default agents service", async () => {
    const { startHoldReinServer } = await import("./runtime");

    await startHoldReinServer({ host: "127.0.0.1", port: 3001 });

    expect(mocks.getDefaultScheduledTasksService).toHaveBeenCalledWith({
      agentsService: mocks.agentsService
    });
    expect(mocks.scheduledService.start).toHaveBeenCalledTimes(1);
  });

  it("starts development plugins before bootstrapping server plugins", async () => {
    mocks.startDevPluginManager.mockResolvedValueOnce(mocks.devPluginManager);
    const { startHoldReinServer } = await import("./runtime");

    await startHoldReinServer({
      devPluginPaths: ["./packages/plugins/github"],
      host: "127.0.0.1",
      port: 3001
    });

    expect(mocks.startDevPluginManager).toHaveBeenCalledWith({
      onReload: expect.any(Function),
      pluginPaths: ["./packages/plugins/github"]
    });
    expect(mocks.bootstrapServerPlugins).toHaveBeenCalledWith("/tmp/plugins", {
      devPluginManager: mocks.devPluginManager
    });
  });
});
