import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

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
    getApiEnv: vi.fn(() => ({ pluginRoot: "/tmp/plugins" }))
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

describe("runtime startup", () => {
  it("starts scheduled tasks after creating the default agents service", async () => {
    const { startHoldReinServer } = await import("./runtime");

    await startHoldReinServer({ host: "127.0.0.1", port: 3001 });

    expect(mocks.getDefaultScheduledTasksService).toHaveBeenCalledWith({
      agentsService: mocks.agentsService
    });
    expect(mocks.scheduledService.start).toHaveBeenCalledTimes(1);
  });
});
