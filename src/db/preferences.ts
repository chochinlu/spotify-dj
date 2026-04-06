import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type { PreferenceRecord } from "../types.js";

export function addPreference(db: Database.Database, input: { rule: string; parsed_rule: string }): PreferenceRecord {
  const id = randomUUID();
  db.prepare("INSERT INTO preferences (id, rule, parsed_rule) VALUES (?, ?, ?)").run(id, input.rule, input.parsed_rule);
  return db.prepare("SELECT * FROM preferences WHERE id = ?").get(id) as PreferenceRecord;
}

export function listActivePreferences(db: Database.Database): PreferenceRecord[] {
  return db.prepare("SELECT * FROM preferences WHERE active = 1 ORDER BY created_at DESC").all() as PreferenceRecord[];
}

export function deactivatePreference(db: Database.Database, id: string): void {
  db.prepare("UPDATE preferences SET active = 0 WHERE id = ?").run(id);
}
