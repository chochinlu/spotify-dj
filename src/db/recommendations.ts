import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type { RecommendationRecord } from "../types.js";

export function addRecommendation(db: Database.Database, input: { track_id: string; strategy: string }): RecommendationRecord {
  const id = randomUUID();
  db.prepare("INSERT INTO recommendations (id, track_id, strategy) VALUES (?, ?, ?)").run(id, input.track_id, input.strategy);
  return db.prepare("SELECT * FROM recommendations WHERE id = ?").get(id) as RecommendationRecord;
}

export function getRecommendedTrackIds(db: Database.Database, opts?: { includeRejected?: boolean }): string[] {
  const query = opts?.includeRejected
    ? "SELECT DISTINCT track_id FROM recommendations"
    : "SELECT DISTINCT track_id FROM recommendations WHERE status != 'rejected'";
  return (db.prepare(query).all() as { track_id: string }[]).map((r) => r.track_id);
}

export function updateRecommendationStatus(db: Database.Database, id: string, status: "accepted" | "rejected", playlistId?: string): void {
  if (playlistId) {
    db.prepare("UPDATE recommendations SET status = ?, playlist_id = ? WHERE id = ?").run(status, playlistId, id);
  } else {
    db.prepare("UPDATE recommendations SET status = ? WHERE id = ?").run(status, id);
  }
}
