import type Database from "better-sqlite3";
import type { SpotifyClient, SpotifyTrack } from "../spotify/client.js";
import { createPlaylist } from "../db/playlists.js";
import { upsertTracks } from "../db/tracks.js";

export async function handleCreatePlaylist(
  args: { description: string; track_count?: number; public?: boolean },
  client: SpotifyClient,
  db: Database.Database,
) {
  const trackCount = args.track_count ?? 20;
  const isPublic = args.public ?? false;

  const results: SpotifyTrack[] = await client.searchTracks(
    args.description,
    trackCount,
  );

  if (results.length === 0) {
    return {
      playlist_id: null,
      name: null,
      tracks: [],
      track_count: 0,
      suggestion: "Try broadening your description",
    };
  }

  const user = await client.getCurrentUser();
  const playlistName = `DJ: ${args.description.slice(0, 60)}`;
  const spotifyPlaylistId = await client.createPlaylist(
    user.id,
    playlistName,
    args.description,
    isPublic,
  );

  const trackUris = results.map((t) => t.uri);
  await client.addTracksToPlaylist(spotifyPlaylistId, trackUris);

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

  // Save playlist to DB
  const record = createPlaylist(db, {
    spotify_id: spotifyPlaylistId,
    name: playlistName,
    description: args.description,
  });

  // Link tracks to playlist
  const insertLink = db.prepare(
    "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)",
  );
  const tx = db.transaction(() => {
    for (const t of results) {
      insertLink.run(record.id, t.id);
    }
  });
  tx();

  return {
    playlist_id: spotifyPlaylistId,
    name: playlistName,
    tracks: results.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
    })),
    track_count: results.length,
  };
}
