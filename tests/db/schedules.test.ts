import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { initSchema } from "../../src/db/schema";
import { createPlaylist } from "../../src/db/playlists";
import { createSchedule, listSchedules, getDueSchedules, markScheduleRun } from "../../src/db/schedules";

describe("schedules", () => {
  let db: Database.Database;
  let playlistId: string;
  beforeEach(() => {
    db = new Database(":memory:");
    initSchema(db);
    playlistId = createPlaylist(db, { spotify_id: "sp1", name: "Test", description: null }).id;
  });
  it("creates and lists schedules", () => {
    createSchedule(db, { playlist_id: playlistId, cron: "0 9 * * 1", strategy: "auto" });
    expect(listSchedules(db)).toHaveLength(1);
  });
  it("finds due schedules (never run = always due)", () => {
    createSchedule(db, { playlist_id: playlistId, cron: "0 9 * * 1", strategy: "auto" });
    const due = getDueSchedules(db);
    expect(due).toHaveLength(1);
  });
  it("marks schedule as run", () => {
    const s = createSchedule(db, { playlist_id: playlistId, cron: "0 9 * * 1", strategy: "auto" });
    markScheduleRun(db, s.id);
    const updated = listSchedules(db);
    expect(updated[0].last_run).not.toBeNull();
  });
});
