import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { createInMemoryModelProviderRepository } from "../model-providers/model-provider-repository";
import { createModelProvidersService } from "../model-providers/model-providers-service";
import { createInMemoryModelProxyRepository } from "./model-proxy-repository";
import { createModelProxiesService } from "./model-proxies-service";

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");

async function createTestApp() {
  const modelProvidersService = createModelProvidersService({
    providerApiKeyEncryptionKey: TEST_ENCRYPTION_KEY,
    repository: createInMemoryModelProviderRepository()
  });
  const modelProxiesService = createModelProxiesService({
    modelProvidersService,
    repository: createInMemoryModelProxyRepository(),
    usageRepository: { listModelTokenUsageSince: () => [] }
  });

  return {
    app: await createApp({ modelProxiesService, service: modelProvidersService }),
    modelProvidersService
  };
}

describe("model proxy routes", () => {
  it("creates, lists, reads, updates, and deletes model proxies", async () => {
    const { app, modelProvidersService } = await createTestApp();
    modelProvidersService.storeProviderApiKey("openai", "test-key");

    const createResponse = await request(app).post("/api/v1/model-proxies").send({
      candidates: [
        {
          limits: [{ maxTokens: 1000, windowType: "hours", windowHours: 24 }],
          modelId: "gpt-4.1",
          priority: 1,
          provider: "openai"
        }
      ],
      modelId: "coding-agent",
      name: "Coding Agent"
    });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data).toEqual(
      expect.objectContaining({ modelId: "coding-agent", name: "Coding Agent" })
    );

    const listResponse = await request(app).get("/api/v1/model-proxies");
    expect(listResponse.body.data).toHaveLength(1);

    const readResponse = await request(app).get(
      "/api/v1/model-proxies/coding-agent"
    );
    expect(readResponse.body.data.candidates[0].limits[0]).toEqual(
      expect.objectContaining({ maxTokens: 1000, windowType: "hours" })
    );

    const updateResponse = await request(app)
      .put("/api/v1/model-proxies/coding-agent")
      .send({
        candidates: [
          {
            limits: [{ maxTokens: 2000, windowType: "day" }],
            modelId: "gpt-4.1-mini",
            priority: 1,
            provider: "openai"
          }
        ],
        modelId: "daily-agent",
        name: "Daily Agent"
      });
    expect(updateResponse.body.data).toEqual(
      expect.objectContaining({ modelId: "daily-agent", name: "Daily Agent" })
    );

    const deleteResponse = await request(app).delete(
      "/api/v1/model-proxies/daily-agent"
    );
    expect(deleteResponse.status).toBe(200);
  });

  it("allocates a proxy model id when creating without one", async () => {
    const { app, modelProvidersService } = await createTestApp();
    modelProvidersService.storeProviderApiKey("openai", "test-key");

    const createResponse = await request(app).post("/api/v1/model-proxies").send({
      candidates: [
        {
          limits: [{ maxTokens: 1000, windowType: "day" }],
          modelId: "gpt-4.1",
          priority: 1,
          provider: "openai"
        }
      ],
      name: "Coding Agent"
    });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data).toEqual(
      expect.objectContaining({
        modelId: expect.stringMatching(/^local-[a-z0-9-]+$/),
        name: "Coding Agent"
      })
    );
  });

  it("exposes proxies as local provider models", async () => {
    const { app, modelProvidersService } = await createTestApp();
    modelProvidersService.storeProviderApiKey("openai", "test-key");
    await request(app).post("/api/v1/model-proxies").send({
      candidates: [
        {
          limits: [{ maxTokens: 1000, windowType: "day" }],
          modelId: "gpt-4.1",
          priority: 1,
          provider: "openai"
        }
      ],
      modelId: "coding-agent",
      name: "Coding Agent"
    });

    const providersResponse = await request(app).get("/api/v1/model-providers");
    expect(providersResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "local", source: "proxy" })
      ])
    );

    const modelsResponse = await request(app).get(
      "/api/v1/model-providers/local/models"
    );
    expect(modelsResponse.body.data).toEqual([
      expect.objectContaining({
        id: "coding-agent",
        name: "Coding Agent",
        provider: "local"
      })
    ]);
  });
});
