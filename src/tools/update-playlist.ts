import type Database from "better-sqlite3";
import type { SpotifyClient, SpotifyTrack } from "../spotify/client.js";
import { getPlaylistBySpotifyId } from "../db/playlists.js";
import { upsertTracks } from "../db/tracks.js";

export async function handleUpdatePlaylist(
  args: {
    playlist_id: string;
    action: "add" | "remove" | "refresh";
    description?: string;
    track_ids?: string[];
  },
  client: SpotifyClient,
  db: Database.Database,
) {
  const { playlist_id, action } = args;

  if (action === "add") {
    if (!args.description) {
      throw new Error("description is required for 'add' action");
    }
    const results: SpotifyTrack[] = await client.searchTracks(
      args.description,
      10,
    );
    if (results.length === 0) {
      return { playlist_id, action, tracks_added: 0, message: "No tracks found" };
    }
    const trackUris = results.map((t) => t.uri);
    await client.addTracksToPlaylist(playlist_id, trackUris);

    // Save tracks to DB
    upsertTracks(
      db,
      results.map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        album: t.album.name,
        duration_ms: t.duration_ms,
        genre_tags: [],
        language: null,
      })),
    );

    // Link to playlist in DB
    const record = getPlaylistBySpotifyId(db, playlist_id);
    if (record) {
      const insertLink = db.prepare(
        "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)",
      );
      const tx = db.transaction(() => {
        for (const t of results) {
          insertLink.run(record.id, t.id);
        }
      });
      tx();
    }

    return {
      playlist_id,
      action,
      tracks_added: results.length,
      tracks: results.map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
      })),
    };
  }

  if (action === "remove") {
    if (!args.track_ids || args.track_ids.length === 0) {
      throw new Error("track_ids is required for 'remove' action");
    }
    const trackUris = args.track_ids.map((id) => `spotify:track:${id}`);
    await client.removeTracksFromPlaylist(playlist_id, trackUris);

    // Remove from DB link table
    const record = getPlaylistBySpotifyId(db, playlist_id);
    if (record) {
      const deleteLink = db.prepare(
        "DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
      );
      const tx = db.transaction(() => {
        for (const trackId of args.track_ids!) {
          deleteLink.run(record.id, trackId);
        }
      });
      tx();
    }

    return { playlist_id, action, tracks_removed: args.track_ids.length };
  }

  // action === "refresh"
  if (!args.description) {
    throw new Error("description is required for 'refresh' action");
  }

  // Get existing tracks and remove them
  const existingTracks = await client.getPlaylistTracks(playlist_id);
  if (existingTracks.length > 0) {
    const existingUris = existingTracks.map((t) => t.uri);
    await client.removeTracksFromPlaylist(playlist_id, existingUris);
  }

  // Search for new tracks and add them
  const results: SpotifyTrack[] = await client.searchTracks(
    args.description,
    20,
  );
  if (results.length > 0) {
    const trackUris = results.map((t) => t.uri);
    await client.addTracksToPlaylist(playlist_id, trackUris);

    upsertTracks(
      db,
      results.map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        album: t.album.name,
        duration_ms: t.duration_ms,
        genre_tags: [],
        language: null,
      })),
    );
  }

  // Update DB link table
  const record = getPlaylistBySpotifyId(db, playlist_id);
  if (record) {
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?").run(
        record.id,
      );
      const insertLink = db.prepare(
        "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)",
      );
      for (const t of results) {
        insertLink.run(record.id, t.id);
      }
    });
    tx();
  }

  return {
    playlist_id,
    action,
    tracks_removed: existingTracks.length,
    tracks_added: results.length,
    tracks: results.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
    })),
  };
}
