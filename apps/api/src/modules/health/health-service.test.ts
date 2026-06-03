import { describe, expect, it } from "vitest";

import { getHealthStatus } from "../../service/health-service";

describe("getHealthStatus", () => {
  it("returns a healthy payload", () => {
    expect(getHealthStatus()).toEqual({
      service: "api",
      status: "ok",
      version: "v1"
    });
  });
});
