import type Database from "better-sqlite3";
import type { SpotifyClient } from "../spotify/client.js";
import type { ApiAvailability } from "../types.js";
import {
  getRecommendations,
  type RecommendationResult,
} from "../recommender/engine.js";
import { addRecommendation } from "../db/recommendations.js";
import { upsertTracks } from "../db/tracks.js";

export async function handleDiscover(
  args: {
    strategy: "similar" | "curated" | "surprise" | "auto";
    count?: number;
    seed_playlist_id?: string;
  },
  client: SpotifyClient,
  db: Database.Database,
  apiAvailability: ApiAvailability,
) {
  const count = args.count ?? 10;

  // Gather user's top artists and genres for seeding
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

  const result: RecommendationResult = await getRecommendations(
    client,
    db,
    { strategy: args.strategy, count, seedArtistIds, topGenres },
    apiAvailability,
  );

  // Save discovered tracks to DB
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

  // Record as recommendations
  for (const track of result.tracks) {
    addRecommendation(db, {
      track_id: track.id,
      strategy: result.strategy_used,
    });
  }

  return {
    tracks: result.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artist,
      album: t.album,
      duration_ms: t.duration_ms,
    })),
    strategy_used: result.strategy_used,
    reason: result.reason,
  };
}
