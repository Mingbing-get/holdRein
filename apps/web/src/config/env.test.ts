import { describe, expect, it } from "vitest";

import { getAppEnv } from "./env";

describe("getAppEnv", () => {
  it("returns the configured api base url", () => {
    expect(
      getAppEnv({
        VITE_API_BASE_URL: "http://localhost:5000"
      } as unknown as ImportMetaEnv)
    ).toEqual({
      apiBaseUrl: "http://localhost:5000"
    });
  });

  it("falls back to the default api base url", () => {
    expect(getAppEnv({} as unknown as ImportMetaEnv)).toEqual({
      apiBaseUrl: ""
    });
  });
});
