import type Database from "better-sqlite3";
import { getDueSchedules } from "../db/schedules.js";
import type { ScheduleRecord } from "../types.js";

export function findDueSchedules(db: Database.Database): ScheduleRecord[] {
  return getDueSchedules(db);
}
