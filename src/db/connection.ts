import * as path from "node:path";
import Database from "better-sqlite3";
import { initSchema } from "./schema.js";

let db: Database.Database | null = null;

const DEFAULT_DB_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "data",
  "spotify-dj.db",
);

export function getDb(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

export function getTestDb(): Database.Database {
  const testDb = new Database(":memory:");
  testDb.pragma("foreign_keys = ON");
  initSchema(testDb);
  return testDb;
}
