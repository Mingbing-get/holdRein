import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseEnv } from "node:util";

import type { EncryptedSecret } from "./types";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const ENV_KEY = "PROVIDER_API_KEY_ENCRYPTION_KEY";

export interface LoadProviderEncryptionKeyOptions {
  readonly userEnvDir?: string;
}

export function encryptSecret(
  plaintext: string,
  base64EncodedKey: string
): EncryptedSecret {
  const key = decodeEncryptionKey(base64EncodedKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptSecret(
  encryptedSecret: EncryptedSecret,
  base64EncodedKey: string
): string {
  const key = decodeEncryptionKey(base64EncodedKey);
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encryptedSecret.iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(encryptedSecret.tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedSecret.ciphertext, "base64")),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
}

export function loadProviderApiKeyEncryptionKey(
  options: LoadProviderEncryptionKeyOptions = {}
): string {
  const envDir = options.userEnvDir ?? getDefaultUserEnvDir();
  const envPath = resolve(envDir, ".env");
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const parsed = existing.trim()
    ? (parseEnv(existing) as Record<string, string>)
    : {};
  const current = parsed[ENV_KEY];

  if (current) {
    return current;
  }

  const generated = randomBytes(KEY_LENGTH).toString("base64");
  mkdirSync(dirname(envPath), { recursive: true });
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  writeFileSync(envPath, `${existing}${prefix}${ENV_KEY}=${generated}\n`);
  return generated;
}

function getDefaultUserEnvDir(): string {
  return join(homedir(), ".hold-rein");
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
