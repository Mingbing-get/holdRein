import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import * as schema from "./schema";
import { ensureDatabaseDirectory, migrateDatabase } from "./index";

describe("database", () => {
  it("exports the custom provider tables and removes the workspace table", () => {
    expect(schema).toHaveProperty("customModelProviders");
    expect(schema).toHaveProperty("providerApiKeys");
    expect(schema).toHaveProperty("customProviderModels");
    expect(schema).not.toHaveProperty("workspaces");
  });

  it("creates the custom provider schema", () => {
    const exec = vi.fn();

    migrateDatabase({ exec } as { exec: (sql: string) => void });

    expect(exec).toHaveBeenCalledTimes(7);
    expect(exec).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS custom_model_providers")
    );
    expect(exec).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS provider_api_keys")
    );
    expect(exec).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS custom_provider_models")
    );
    expect(exec).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining("ALTER TABLE custom_provider_models ADD COLUMN name")
    );
  });

  it("creates parent directories for the sqlite database path", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "hold-rein-db-"));
    const databasePath = join(tempRoot, "nested", "hold-rein.sqlite");

    try {
      const resolvedPath = ensureDatabaseDirectory(databasePath);

      expect(resolvedPath).toContain("/nested/hold-rein.sqlite");
      expect(() => rmSync(join(tempRoot, "nested"), { recursive: true })).not.toThrow();
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});
