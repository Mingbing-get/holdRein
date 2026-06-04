import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { createInMemoryModelProviderRepository } from "./model-provider-repository";
import { createModelProvidersService } from "./model-providers-service";

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");

function createTestApp() {
  const repository = createInMemoryModelProviderRepository();
  const service = createModelProvidersService({
    providerApiKeyEncryptionKey: TEST_ENCRYPTION_KEY,
    repository
  });

  return {
    app: createApp({ service }),
    repository,
    service
  };
}

describe("model provider routes", () => {
  it("lists all available pi-ai providers", async () => {
    const response = await request(createTestApp().app).get("/api/v1/model-providers");

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.msg).toBe("ok");
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "openai",
          source: "builtin"
        }),
        expect.objectContaining({
          id: "google",
          source: "builtin"
        })
      ])
    );
  });

  it("creates a custom provider and returns it as custom", async () => {
    const { app } = createTestApp();

    const createResponse = await request(app)
      .post("/api/v1/model-providers/custom")
      .send({
        baseUrl: "https://example.com/v1",
        provider: "acme-ai"
      });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body).toEqual({
      code: 0,
      msg: "ok",
      data: expect.objectContaining({
        baseUrl: "https://example.com/v1",
        provider: "acme-ai"
      })
    });

    const listResponse = await request(app).get("/api/v1/model-providers");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          baseUrl: "https://example.com/v1",
          id: "acme-ai",
          modelCount: 0,
          source: "custom"
        })
      ])
    );
  });

  it("creates and updates a custom provider model", async () => {
    const { app } = createTestApp();

    await request(app).post("/api/v1/model-providers/custom").send({
      baseUrl: "https://example.com/v1",
      provider: "acme-ai"
    });

    const createModelResponse = await request(app)
      .post("/api/v1/model-providers/acme-ai/models")
      .send({
        api: "responses",
        contextWindow: 32000,
        input: ["text"],
        maxTokens: 4096,
        modelId: "acme-chat",
        reasoning: false
      });

    expect(createModelResponse.status).toBe(200);
    expect(createModelResponse.body).toEqual({
      code: 0,
      msg: "ok",
      data: expect.objectContaining({
        id: "acme-chat",
        provider: "acme-ai"
      })
    });

    const updateModelResponse = await request(app)
      .put("/api/v1/model-providers/acme-ai/models/acme-chat")
      .send({
        api: "chat-completions",
        contextWindow: 64000,
        input: ["text", "image"],
        maxTokens: 8192,
        reasoning: true
      });

    expect(updateModelResponse.status).toBe(200);
    expect(updateModelResponse.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        api: "chat-completions",
        contextWindow: 64000,
        id: "acme-chat",
        input: ["text", "image"],
        maxTokens: 8192,
        name: "acme-chat",
        provider: "acme-ai",
        reasoning: true
      }
    });

    const modelsResponse = await request(app).get(
      "/api/v1/model-providers/acme-ai/models"
    );

    expect(modelsResponse.status).toBe(200);
    expect(modelsResponse.body.data).toEqual([
      {
        api: "chat-completions",
        contextWindow: 64000,
        id: "acme-chat",
        input: ["text", "image"],
        maxTokens: 8192,
        name: "acme-chat",
        provider: "acme-ai",
        reasoning: true
      }
    ]);
  });

  it("deletes a custom provider model", async () => {
    const { app } = createTestApp();

    await request(app).post("/api/v1/model-providers/custom").send({
      baseUrl: "https://example.com/v1",
      provider: "acme-ai"
    });
    await request(app).post("/api/v1/model-providers/acme-ai/models").send({
      api: "responses",
      contextWindow: 32000,
      input: ["text"],
      maxTokens: 4096,
      modelId: "acme-chat",
      reasoning: false
    });

    const deleteResponse = await request(app).delete(
      "/api/v1/model-providers/acme-ai/models/acme-chat"
    );

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        modelId: "acme-chat",
        provider: "acme-ai"
      }
    });

    const modelsResponse = await request(app).get(
      "/api/v1/model-providers/acme-ai/models"
    );

    expect(modelsResponse.status).toBe(200);
    expect(modelsResponse.body.data).toEqual([]);
  });

  it("updates a custom provider", async () => {
    const { app } = createTestApp();

    await request(app).post("/api/v1/model-providers/custom").send({
      baseUrl: "https://example.com/v1",
      provider: "acme-ai"
    });

    const response = await request(app)
      .put("/api/v1/model-providers/custom/acme-ai")
      .send({
        baseUrl: "https://api.acme.ai/v2",
        provider: "acme-enterprise"
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      msg: "ok",
      data: expect.objectContaining({
        baseUrl: "https://api.acme.ai/v2",
        provider: "acme-enterprise"
      })
    });

    const listResponse = await request(app).get("/api/v1/model-providers");

    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          baseUrl: "https://api.acme.ai/v2",
          id: "acme-enterprise",
          source: "custom"
        })
      ])
    );
  });

  it("deletes a custom provider and its related data", async () => {
    const { app, repository } = createTestApp();

    await request(app).post("/api/v1/model-providers/custom").send({
      baseUrl: "https://example.com/v1",
      provider: "acme-ai"
    });
    await request(app).post("/api/v1/model-providers/acme-ai/models").send({
      api: "responses",
      contextWindow: 32000,
      input: ["text"],
      maxTokens: 4096,
      modelId: "acme-chat",
      reasoning: false
    });
    await request(app)
      .put("/api/v1/model-providers/acme-ai/api-key")
      .send({ apiKey: "test-acme-key" });

    const deleteResponse = await request(app).delete(
      "/api/v1/model-providers/custom/acme-ai"
    );

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        provider: "acme-ai"
      }
    });

    const listResponse = await request(app).get("/api/v1/model-providers");

    expect(listResponse.body.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "acme-ai"
        })
      ])
    );
    expect(repository.findProviderApiKeyByProvider("acme-ai")).toBeUndefined();
  });

  it("lists models for a selected provider", async () => {
    const response = await request(createTestApp().app).get(
      "/api/v1/model-providers/openai/models"
    );

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gpt-5",
          provider: "openai"
        })
      ])
    );
  });

  it("stores an encrypted api key for a provider", async () => {
    const { app, repository, service } = createTestApp();

    const setResponse = await request(app)
      .put("/api/v1/model-providers/openai/api-key")
      .send({ apiKey: "test-openai-key" });

    expect(setResponse.status).toBe(200);
    expect(setResponse.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        hasApiKey: true,
        provider: "openai"
      }
    });

    expect(repository.findProviderApiKeyByProvider("openai")).toEqual(
      expect.objectContaining({
        provider: "openai"
      })
    );

    const providersResponse = await request(app).get("/api/v1/model-providers");

    expect(providersResponse.status).toBe(200);
    expect(providersResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hasApiKey: true,
          id: "openai"
        })
      ])
    );

    expect(service.getConfiguredModelForProvider("openai", "gpt-5")).toEqual(
      expect.objectContaining({
        apiKey: "test-openai-key"
      })
    );
  });
});
