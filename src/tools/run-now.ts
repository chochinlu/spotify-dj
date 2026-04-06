import type Database from "better-sqlite3";
import type { SpotifyClient } from "../spotify/client.js";
import type { ApiAvailability } from "../types.js";
import { getRecommendations } from "../recommender/engine.js";
import { addRecommendation } from "../db/recommendations.js";
import { upsertTracks } from "../db/tracks.js";
import { markScheduleRun } from "../db/schedules.js";
import type { ScheduleRecord } from "../types.js";

export async function handleRunNow(
  args: { schedule_id: string },
  client: SpotifyClient,
  db: Database.Database,
  apiAvailability: ApiAvailability,
) {
  // Find the schedule
  const schedule = db
    .prepare("SELECT * FROM schedules WHERE id = ?")
    .get(args.schedule_id) as ScheduleRecord | undefined;

  if (!schedule) {
    throw new Error(`Schedule not found: ${args.schedule_id}`);
  }

  // Find the playlist's spotify_id
  const playlist = db
    .prepare("SELECT spotify_id FROM playlists WHERE id = ?")
    .get(schedule.playlist_id) as { spotify_id: string } | undefined;

  if (!playlist) {
    throw new Error(`Playlist not found for schedule: ${args.schedule_id}`);
  }

  // Gather user's top artists/genres for seeding
  const topArtists = await client.getTopArtists("medium_term", 20);
  const seedArtistIds = topArtists.map((a) => a.id).slice(0, 5);

  const genreCounts = new Map<string, number>();
  for (const artist of topArtists) {
    for (const genre of artist.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre]) => genre);

  const strategy = schedule.strategy as
    | "similar"
    | "curated"
    | "surprise"
    | "auto";

  const result = await getRecommendations(
    client,
    db,
    { strategy, count: 10, seedArtistIds, topGenres },
    apiAvailability,
  );

  // Save tracks to DB
  upsertTracks(
    db,
    result.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artist,
      album: t.album,
      duration_ms: t.duration_ms,
      genre_tags: [],
      language: null,
    })),
  );

  // Record recommendations
  for (const track of result.tracks) {
    addRecommendation(db, {
      track_id: track.id,
      strategy: result.strategy_used,
    });
  }

  // Add tracks to the Spotify playlist
  if (result.tracks.length > 0) {
    const trackUris = result.tracks.map((t) => `spotify:track:${t.id}`);
    await client.addTracksToPlaylist(playlist.spotify_id, trackUris);

    // Link tracks in DB
    const insertLink = db.prepare(
      "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)",
    );
    const tx = db.transaction(() => {
      for (const t of result.tracks) {
        insertLink.run(schedule.playlist_id, t.id);
      }
    });
    tx();
  }

  // Mark schedule as run
  markScheduleRun(db, schedule.id);

  return {
    schedule_id: schedule.id,
    playlist_id: playlist.spotify_id,
    tracks_added: result.tracks.length,
    tracks_removed: 0,
    strategy_used: result.strategy_used,
    tracks: result.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artist,
    })),
  };
}
