import type Database from "better-sqlite3";
import type { SpotifyClient } from "../spotify/client.js";
import {
  getPlaylistBySpotifyId,
  deletePlaylist,
} from "../db/playlists.js";

export async function handleDeletePlaylist(
  args: { playlist_id: string },
  client: SpotifyClient,
  db: Database.Database,
) {
  await client.unfollowPlaylist(args.playlist_id);

  const record = getPlaylistBySpotifyId(db, args.playlist_id);
  if (record) {
    deletePlaylist(db, record.id);
  }

  return { playlist_id: args.playlist_id, deleted: true };
}
