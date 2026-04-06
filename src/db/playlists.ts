import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type { PlaylistRecord } from "../types.js";

export function createPlaylist(db: Database.Database, input: { spotify_id: string; name: string; description: string | null }): PlaylistRecord {
  const id = randomUUID();
  db.prepare("INSERT INTO playlists (id, spotify_id, name, description) VALUES (?, ?, ?, ?)").run(id, input.spotify_id, input.name, input.description);
  return getPlaylist(db, id)!;
}

export function getPlaylist(db: Database.Database, id: string): PlaylistRecord | undefined {
  return db.prepare("SELECT * FROM playlists WHERE id = ?").get(id) as PlaylistRecord | undefined;
}

export function getPlaylistBySpotifyId(db: Database.Database, spotifyId: string): PlaylistRecord | undefined {
  return db.prepare("SELECT * FROM playlists WHERE spotify_id = ?").get(spotifyId) as PlaylistRecord | undefined;
}

export function listPlaylists(db: Database.Database): PlaylistRecord[] {
  return db.prepare("SELECT * FROM playlists ORDER BY created_at DESC").all() as PlaylistRecord[];
}

export function deletePlaylist(db: Database.Database, id: string): void {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?").run(id);
    db.prepare("DELETE FROM schedules WHERE playlist_id = ?").run(id);
    db.prepare("DELETE FROM playlists WHERE id = ?").run(id);
  });
  tx();
}
