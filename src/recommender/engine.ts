import type Database from "better-sqlite3";
import type { SpotifyClient } from "../spotify/client.js";
import type { Track, ApiAvailability } from "../types.js";
import { findSimilarTracks } from "./similar.js";
import { findCuratedTracks } from "./curated.js";
import { findSurpriseTracks } from "./surprise.js";
import { getRecommendedTrackIds } from "../db/recommendations.js";

export type RecommendationOptions = {
  strategy: "similar" | "curated" | "surprise" | "auto";
  count: number;
  seedArtistIds: string[];
  topGenres: string[];
};

export type RecommendationResult = {
  tracks: Track[];
  strategy_used: string;
  reason: string;
};

/**
 * Orchestrate recommendations by strategy.
 *
 * - "similar": 100% similar tracks
 * - "curated": 100% curated (featured playlists)
 * - "surprise": 100% surprise (unfamiliar genres)
 * - "auto": 60% similar, 30% curated, 10% surprise
 */
export async function getRecommendations(
  client: SpotifyClient,
  db: Database.Database,
  options: RecommendationOptions,
  apiAvailability: ApiAvailability,
): Promise<RecommendationResult> {
  const previouslyRecommended = getRecommendedTrackIds(db);
  const excludeIds = new Set(previouslyRecommended);

  const { strategy, count, seedArtistIds, topGenres } = options;

  if (strategy === "similar") {
    const tracks = await findSimilarTracks(
      client,
      seedArtistIds,
      apiAvailability,
      excludeIds,
      topGenres,
      count,
    );
    return {
      tracks,
      strategy_used: "similar",
      reason: "Finding tracks from artists related to your favorites.",
    };
  }

  if (strategy === "curated") {
    const tracks = await findCuratedTracks(
      client,
      topGenres,
      excludeIds,
      count,
    );
    return {
      tracks,
      strategy_used: "curated",
      reason: "Picking tracks from Spotify's featured playlists.",
    };
  }

  if (strategy === "surprise") {
    const tracks = await findSurpriseTracks(
      client,
      topGenres,
      excludeIds,
      count,
    );
    return {
      tracks,
      strategy_used: "surprise",
      reason: "Exploring genres outside your usual taste.",
    };
  }

  // "auto" strategy: mix 60% similar, 30% curated, 10% surprise
  const similarCount = Math.max(1, Math.round(count * 0.6));
  const curatedCount = Math.max(1, Math.round(count * 0.3));
  const surpriseCount = Math.max(1, count - similarCount - curatedCount);

  const similarTracks = await findSimilarTracks(
    client,
    seedArtistIds,
    apiAvailability,
    excludeIds,
    topGenres,
    similarCount,
  );

  // Add similar tracks to excludeIds so curated doesn't duplicate
  for (const t of similarTracks) excludeIds.add(t.id);

  const curatedTracks = await findCuratedTracks(
    client,
    topGenres,
    excludeIds,
    curatedCount,
  );

  for (const t of curatedTracks) excludeIds.add(t.id);

  const surpriseTracks = await findSurpriseTracks(
    client,
    topGenres,
    excludeIds,
    surpriseCount,
  );

  const tracks = [...similarTracks, ...curatedTracks, ...surpriseTracks];

  return {
    tracks,
    strategy_used: "auto",
    reason: `Mixed strategy: ${similarTracks.length} similar, ${curatedTracks.length} curated, ${surpriseTracks.length} surprise.`,
  };
}
