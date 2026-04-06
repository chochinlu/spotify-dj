import type Database from "better-sqlite3";
import type { SpotifyClient } from "../spotify/client.js";
import { updateRecommendationStatus } from "../db/recommendations.js";
import { getPlaylistBySpotifyId } from "../db/playlists.js";

export async function handlePreviewTracks(
  args: {
    track_ids: string[];
    action: "accept" | "reject" | "accept_to";
    target_playlist_id?: string;
  },
  client: SpotifyClient,
  db: Database.Database,
) {
  const { track_ids, action, target_playlist_id } = args;

  if (action === "accept_to" && !target_playlist_id) {
    throw new Error("target_playlist_id is required for 'accept_to' action");
  }

  // Find recommendation records for these track IDs
  const recs = db
    .prepare(
      `SELECT id, track_id FROM recommendations WHERE track_id IN (${track_ids.map(() => "?").join(",")}) AND status = 'pending'`,
    )
    .all(...track_ids) as { id: string; track_id: string }[];

  const status = action === "reject" ? "rejected" : "accepted";

  // Resolve internal playlist ID from Spotify ID for FK compliance
  let internalPlaylistId: string | undefined;
  if (action === "accept_to" && target_playlist_id) {
    const record = getPlaylistBySpotifyId(db, target_playlist_id);
    internalPlaylistId = record?.id;
  }

  for (const rec of recs) {
    updateRecommendationStatus(
      db,
      rec.id,
      status as "accepted" | "rejected",
      internalPlaylistId,
    );
  }

  // For accept_to, add tracks to the target playlist
  if (action === "accept_to" && target_playlist_id) {
    const trackUris = track_ids.map((id) => `spotify:track:${id}`);
    await client.addTracksToPlaylist(target_playlist_id, trackUris);
  }

  return {
    action,
    tracks_processed: recs.length,
    track_ids: recs.map((r) => r.track_id),
    target_playlist_id: target_playlist_id ?? null,
  };
}
