import { loadApiEnv } from "../../config/env";
import { DB_FILE } from "../../config/const";
import { createDatabase, migrateDatabase } from "../../db";
import { createSqliteWorkspaceRepository } from "./workspace-repository";
import { getDefaultActiveTaskRunRegistry } from "../agents/active-task-run-registry";
import {
  createWorkspacesService,
  type WorkspacesService
} from "./workspaces-service";

let service: WorkspacesService | undefined;

export function getDefaultWorkspacesService(): WorkspacesService {
  if (service) {
    return service;
  }

  loadApiEnv();

  const database = createDatabase(
    process.env.SQLITE_DB_PATH ?? DB_FILE
  );

  migrateDatabase(database.sqlite);
  service = createWorkspacesService({
    activeTaskRuns: getDefaultActiveTaskRunRegistry(),
    repository: createSqliteWorkspaceRepository(database)
  });

  return service;
}
