import type Database from "better-sqlite3";
import { listPlaylists } from "../db/playlists.js";

export async function handleListPlaylists(db: Database.Database) {
  const playlists = listPlaylists(db);
  return {
    playlists: playlists.map((p) => ({
      playlist_id: p.spotify_id,
      name: p.name,
      track_count: (
        db
          .prepare(
            "SELECT COUNT(*) as cnt FROM playlist_tracks WHERE playlist_id = ?",
          )
          .get(p.id) as { cnt: number }
      ).cnt,
      last_updated: p.updated_at,
      auto_update: !!p.auto_update,
    })),
  };
}
