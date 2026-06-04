import { describe, expect, it } from "vitest";

import {
  decryptProviderApiKey,
  encryptProviderApiKey
} from "./model-provider-api-key-crypto";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("provider api key crypto", () => {
  it("round-trips an encrypted provider api key", () => {
    const encryptedApiKey = encryptProviderApiKey("secret-key", TEST_KEY);

    expect(decryptProviderApiKey(encryptedApiKey, TEST_KEY)).toBe("secret-key");
  });

  it("rejects keys with the wrong length", () => {
    expect(() => encryptProviderApiKey("secret-key", "invalid")).toThrow(
      "PROVIDER_API_KEY_ENCRYPTION_KEY must be a base64-encoded 32-byte key"
    );
  });
});
