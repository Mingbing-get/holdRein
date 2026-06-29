import express from "express";
import request from "supertest";
import { expect, it } from "vitest";

import { createPluginsRouter } from "./plugins-router";

it("returns runtime plugin config", async () => {
  const app = express();

  app.use(
    "/api/v1/plugins",
    createPluginsRouter({
      plugins: [
        {
          id: "demo",
          name: "Demo",
          packageName: "@scope/demo",
          version: "1.0.0",
          webEntry: "/plugin-assets/demo.js"
        }
      ]
    })
  );

  const response = await request(app).get("/api/v1/plugins");

  expect(response.status).toBe(200);
  expect(response.body.data.plugins[0].webEntry).toBe("/plugin-assets/demo.js");
});
