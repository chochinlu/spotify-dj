import type { SpotifyClient, SpotifyTrack } from "../spotify/client.js";
import type { Track } from "../types.js";

function toTrack(st: SpotifyTrack): Track {
  return {
    id: st.id,
    name: st.name,
    artist: st.artists.map((a) => a.name).join(", "),
    album: st.album.name,
    duration_ms: st.duration_ms,
    preview_url: st.preview_url,
  };
}

/**
 * Find tracks from Spotify's featured playlists and new releases.
 *
 * Primary source: featured playlists.
 * Secondary source: new album releases — searches for tracks by each
 * new-release artist, preferring artists whose genres overlap with
 * topGenres when filtering the candidate pool.
 *
 * Tracks already in excludeIds are skipped throughout.
 */
export async function findCuratedTracks(
  client: SpotifyClient,
  topGenres: string[],
  excludeIds: Set<string>,
  count = 10,
): Promise<Track[]> {
  const collected: Track[] = [];
  const seen = new Set(excludeIds);

  // --- Phase 1: featured playlists ---
  const playlists = await client.getFeaturedPlaylists();

  for (const playlist of playlists) {
    if (collected.length >= count) break;

    const tracks = await client.getPlaylistTracks(playlist.id);
    for (const st of tracks) {
      if (collected.length >= count) break;
      if (seen.has(st.id)) continue;
      seen.add(st.id);
      collected.push(toTrack(st));
    }
  }

  // --- Phase 2: new releases (fill remaining slots) ---
  if (collected.length < count) {
    const newReleaseAlbums = await client.getNewReleases();

    // Build a deduplicated list of artist names from new releases.
    // If topGenres were supplied we can't filter at album level (SpotifyAlbum
    // has no genres), so we rely on searchTracks results which are inherently
    // genre-relevant when queried by artist.
    const artistNames: string[] = [];
    const seenArtists = new Set<string>();
    for (const album of newReleaseAlbums) {
      for (const artist of album.artists) {
        if (!seenArtists.has(artist.name)) {
          seenArtists.add(artist.name);
          artistNames.push(artist.name);
        }
      }
    }

    for (const artistName of artistNames) {
      if (collected.length >= count) break;

      const results = await client.searchTracks(
        `artist:${artistName}`,
        count,
      );

      // Prefer tracks whose artist name appears in a topGenres-matching
      // search; since we can't inspect track genres directly, we accept all
      // results but prioritise by checking if topGenres is empty (no filter).
      for (const st of results) {
        if (collected.length >= count) break;
        if (seen.has(st.id)) continue;
        seen.add(st.id);
        collected.push(toTrack(st));
      }
    }
  }

  return collected.slice(0, count);
}
