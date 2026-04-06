import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { initSchema } from "../../src/db/schema";
import { upsertTrack, getTrack } from "../../src/db/tracks";

describe("tracks", () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(":memory:"); initSchema(db); });
  it("upserts a track", () => {
    upsertTrack(db, { id: "t1", name: "Song", artist: "Artist", album: "Album", duration_ms: 200000, genre_tags: ["pop"], language: "en" });
    const t = getTrack(db, "t1");
    expect(t?.name).toBe("Song");
    expect(JSON.parse(t!.genre_tags!)).toEqual(["pop"]);
  });
});
