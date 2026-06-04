import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export interface AppDatabase {
  close: () => void;
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
}

export function ensureDatabaseDirectory(path: string): string {
  const resolvedPath = resolve(path);

  mkdirSync(dirname(resolvedPath), { recursive: true });

  return resolvedPath;
}

export function createDatabase(path: string): AppDatabase {
  const resolvedPath = ensureDatabaseDirectory(path);

  const sqlite = new Database(resolvedPath);

  return {
    close: () => {
      sqlite.close();
    },
    db: drizzle(sqlite, { schema }),
    sqlite
  };
}
