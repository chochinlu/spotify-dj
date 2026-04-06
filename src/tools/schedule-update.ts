import type Database from "better-sqlite3";
import { CronExpressionParser } from "cron-parser";
import { createSchedule } from "../db/schedules.js";

export async function handleScheduleUpdate(
  args: {
    playlist_id: string;
    cron: string;
    strategy?: string;
    enabled?: boolean;
  },
  db: Database.Database,
) {
  // Validate cron expression
  let nextRun: Date;
  try {
    const expression = CronExpressionParser.parse(args.cron);
    nextRun = expression.next().toDate();
  } catch {
    throw new Error(`Invalid cron expression: ${args.cron}`);
  }

  const strategy = args.strategy ?? "auto";

  const schedule = createSchedule(db, {
    playlist_id: args.playlist_id,
    cron: args.cron,
    strategy,
  });

  // Handle enabled flag (default is true from DB)
  if (args.enabled === false) {
    db.prepare("UPDATE schedules SET enabled = 0 WHERE id = ?").run(
      schedule.id,
    );
  }

  return {
    schedule_id: schedule.id,
    playlist_id: args.playlist_id,
    cron: args.cron,
    strategy,
    enabled: args.enabled ?? true,
    next_run: nextRun.toISOString(),
  };
}
