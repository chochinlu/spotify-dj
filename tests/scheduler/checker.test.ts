import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../../src/db/schema";
import { createPlaylist } from "../../src/db/playlists";
import { createSchedule, markScheduleRun } from "../../src/db/schedules";
import { findDueSchedules } from "../../src/scheduler/checker";

describe("scheduler checker", () => {
  it("identifies never-run schedules as due", () => {
    const db = new Database(":memory:");
    initSchema(db);
    const p = createPlaylist(db, { spotify_id: "sp1", name: "Test", description: null });
    createSchedule(db, { playlist_id: p.id, cron: "0 9 * * 1", strategy: "auto" });
    expect(findDueSchedules(db).length).toBe(1);
  });

  it("skips recently-run schedules", () => {
    const db = new Database(":memory:");
    initSchema(db);
    const p = createPlaylist(db, { spotify_id: "sp1", name: "Test", description: null });
    const s = createSchedule(db, { playlist_id: p.id, cron: "0 9 * * 1", strategy: "auto" });
    markScheduleRun(db, s.id);
    expect(findDueSchedules(db).length).toBe(0);
  });
});
