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
          id: "openai"
        }),
        expect.objectContaining({
          id: "google"
        })
      ])
    );
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
