import { DB_FILE } from "../../config/const";
import { loadApiEnv } from "../../config/env";
import { createDatabase, migrateDatabase } from "../../db";
import { getDefaultModelProvidersService } from "../model-providers";
import {
  createSqliteModelProxyRepository,
  type ModelProxyRepository,
  type ModelProxyUsageRepository
} from "./model-proxy-repository";
import {
  createModelProxiesService,
  type ModelProxiesService
} from "./model-proxies-service";

let repository: (ModelProxyRepository & ModelProxyUsageRepository) | undefined;
let service: ModelProxiesService | undefined;

export function getDefaultModelProxiesService(): ModelProxiesService {
  if (service) return service;

  loadApiEnv();
  const database = createDatabase(process.env.SQLITE_DB_PATH ?? DB_FILE);
  migrateDatabase(database.sqlite);
  repository = createSqliteModelProxyRepository(database);
  service = createModelProxiesService({
    modelProvidersService: getDefaultModelProvidersService(),
    repository,
    usageRepository: repository
  });
  return service;
}
