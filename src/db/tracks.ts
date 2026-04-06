import type Database from "better-sqlite3";
import type { TrackRecord } from "../types.js";

export function upsertTrack(db: Database.Database, input: { id: string; name: string; artist: string; album: string | null; duration_ms: number | null; genre_tags: string[]; language: string | null }): void {
  db.prepare("INSERT OR REPLACE INTO tracks (id, name, artist, album, duration_ms, genre_tags, language) VALUES (?, ?, ?, ?, ?, ?, ?)").run(input.id, input.name, input.artist, input.album, input.duration_ms, JSON.stringify(input.genre_tags), input.language);
}

export function getTrack(db: Database.Database, id: string): TrackRecord | undefined {
  return db.prepare("SELECT * FROM tracks WHERE id = ?").get(id) as TrackRecord | undefined;
}

export function upsertTracks(db: Database.Database, tracks: Parameters<typeof upsertTrack>[1][]): void {
  const tx = db.transaction(() => { for (const t of tracks) upsertTrack(db, t); });
  tx();
}
