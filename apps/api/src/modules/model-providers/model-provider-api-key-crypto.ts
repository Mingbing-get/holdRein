import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export interface EncryptedApiKey {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function decryptProviderApiKey(
  encryptedApiKey: EncryptedApiKey,
  base64EncodedKey: string
): string {
  const key = decodeEncryptionKey(base64EncodedKey);
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encryptedApiKey.iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(encryptedApiKey.tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedApiKey.ciphertext, "base64")),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
}

export function encryptProviderApiKey(
  apiKey: string,
  base64EncodedKey: string
): EncryptedApiKey {
  const key = decodeEncryptionKey(base64EncodedKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final()
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64")
  };
}

function decodeEncryptionKey(base64EncodedKey: string): Buffer {
  const key = Buffer.from(base64EncodedKey, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      "PROVIDER_API_KEY_ENCRYPTION_KEY must be a base64-encoded 32-byte key"
    );
  }

  return key;
}
