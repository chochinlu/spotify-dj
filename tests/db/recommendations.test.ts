import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { initSchema } from "../../src/db/schema";
import { upsertTrack } from "../../src/db/tracks";
import { addRecommendation, getRecommendedTrackIds, updateRecommendationStatus } from "../../src/db/recommendations";

describe("recommendations", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(":memory:");
    initSchema(db);
    upsertTrack(db, { id: "t1", name: "S", artist: "A", album: "Al", duration_ms: 100, genre_tags: [], language: "en" });
  });
  it("tracks recommended songs for dedup", () => {
    addRecommendation(db, { track_id: "t1", strategy: "similar" });
    expect(getRecommendedTrackIds(db)).toContain("t1");
  });
  it("updates status to rejected", () => {
    const rec = addRecommendation(db, { track_id: "t1", strategy: "similar" });
    updateRecommendationStatus(db, rec.id, "rejected");
    expect(getRecommendedTrackIds(db, { includeRejected: true })).toContain("t1");
  });
});
