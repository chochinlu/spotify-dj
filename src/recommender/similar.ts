import type { SpotifyClient, SpotifyTrack } from "../spotify/client.js";
import type { Track, ApiAvailability } from "../types.js";

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
 * Find tracks from artists related to the seed artists.
 *
 * Primary path: use getRelatedArtists + getArtistTopTracks.
 * Fallback: if relatedArtists API is unavailable, search by genre keywords.
 */
export async function findSimilarTracks(
  client: SpotifyClient,
  seedArtistIds: string[],
  apiAvailability: ApiAvailability,
  excludeIds: Set<string>,
  topGenres?: string[],
  count = 10,
): Promise<Track[]> {
  const collected: Track[] = [];
  const seen = new Set(excludeIds);

  if (apiAvailability.relatedArtists) {
    for (const artistId of seedArtistIds) {
      if (collected.length >= count) break;

      const related = await client.getRelatedArtists(artistId);
      for (const relArtist of related.slice(0, 3)) {
        if (collected.length >= count) break;

        const topTracks = await client.getArtistTopTracks(relArtist.id);
        for (const st of topTracks) {
          if (collected.length >= count) break;
          if (seen.has(st.id)) continue;
          seen.add(st.id);
          collected.push(toTrack(st));
        }
      }
    }
  } else if (apiAvailability.search && topGenres && topGenres.length > 0) {
    // Fallback: search by genre keywords
    for (const genre of topGenres) {
      if (collected.length >= count) break;

      const results = await client.searchTracks(`genre:${genre}`, count);
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
