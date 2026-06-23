import { DB_FILE } from "../../config/const";
import { loadApiEnv } from "../../config/env";
import { createDatabase, migrateDatabase } from "../../db";
import {
  createSqliteUsageStatsRepository,
  createUsageStatsService,
  type UsageStatsService
} from "./usage-stats-service";

let service: UsageStatsService | undefined;

export function getDefaultUsageStatsService(): UsageStatsService {
  if (service) {
    return service;
  }

  loadApiEnv();

  const database = createDatabase(process.env.SQLITE_DB_PATH ?? DB_FILE);
  migrateDatabase(database.sqlite);
  service = createUsageStatsService({
    repository: createSqliteUsageStatsRepository(database)
  });

  return service;
}
