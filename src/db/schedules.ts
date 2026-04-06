import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { CronExpressionParser } from "cron-parser";
import type { ScheduleRecord } from "../types.js";

export function createSchedule(db: Database.Database, input: { playlist_id: string; cron: string; strategy: string }): ScheduleRecord {
  const id = randomUUID();
  db.prepare("INSERT INTO schedules (id, playlist_id, cron, strategy) VALUES (?, ?, ?, ?)").run(id, input.playlist_id, input.cron, input.strategy);
  return db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as ScheduleRecord;
}

export function listSchedules(db: Database.Database): ScheduleRecord[] {
  return db.prepare("SELECT * FROM schedules ORDER BY created_at DESC").all() as ScheduleRecord[];
}

export function getDueSchedules(db: Database.Database): ScheduleRecord[] {
  const all = db.prepare("SELECT * FROM schedules WHERE enabled = 1").all() as ScheduleRecord[];
  const now = new Date();
  return all.filter((s) => {
    if (!s.last_run) return true;
    const expression = CronExpressionParser.parse(s.cron, { currentDate: new Date(s.last_run) });
    const nextRun = expression.next().toDate();
    return now >= nextRun;
  });
}

export function markScheduleRun(db: Database.Database, id: string): void {
  db.prepare("UPDATE schedules SET last_run = datetime('now') WHERE id = ?").run(id);
}
