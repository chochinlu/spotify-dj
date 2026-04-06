import Database from "better-sqlite3";
import { initSchema } from "./schema.js";

let db: Database.Database | null = null;

export function getDb(dbPath: string = "data/spotify-dj.db"): Database.Database {
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
