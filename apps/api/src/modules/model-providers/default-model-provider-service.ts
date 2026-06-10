import { loadApiEnv } from "../../config/env";
import { DB_FILE } from "../../config/const";
import { createDatabase, migrateDatabase } from "../../db";
import {
  createSqliteModelProviderRepository,
  type ModelProviderRepository
} from "./model-provider-repository";
import {
  createModelProvidersService,
  type ModelProvidersService
} from "./model-providers-service";

let repository: ModelProviderRepository | undefined;
let service: ModelProvidersService | undefined;

export function getDefaultModelProvidersService(): ModelProvidersService {
  if (service) {
    return service;
  }

  loadApiEnv();

  const database = createDatabase(
    process.env.SQLITE_DB_PATH ?? DB_FILE
  );

  migrateDatabase(database.sqlite);
  repository = createSqliteModelProviderRepository(database);
  service = createModelProvidersService({
    providerApiKeyEncryptionKey:
      process.env.PROVIDER_API_KEY_ENCRYPTION_KEY ?? "",
    repository
  });

  return service;
}
