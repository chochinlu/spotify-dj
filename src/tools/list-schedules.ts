import type Database from "better-sqlite3";
import { CronExpressionParser } from "cron-parser";
import { listSchedules } from "../db/schedules.js";

export async function handleListSchedules(db: Database.Database) {
  const schedules = listSchedules(db);

  return {
    schedules: schedules.map((s) => {
      let nextRun: string | null = null;
      try {
        const opts = s.last_run
          ? { currentDate: new Date(s.last_run) }
          : undefined;
        const expression = CronExpressionParser.parse(s.cron, opts);
        nextRun = expression.next().toDate().toISOString();
      } catch {
        // invalid cron — leave nextRun as null
      }

      // Look up playlist name
      const playlist = db
        .prepare("SELECT name FROM playlists WHERE id = ?")
        .get(s.playlist_id) as { name: string } | undefined;

      return {
        schedule_id: s.id,
        playlist_id: s.playlist_id,
        playlist_name: playlist?.name ?? "Unknown",
        cron: s.cron,
        strategy: s.strategy,
        enabled: !!s.enabled,
        last_run: s.last_run,
        next_run: nextRun,
      };
    }),
  };
}
