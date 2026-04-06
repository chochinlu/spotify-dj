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

const ALL_GENRES = [
  "jazz",
  "classical",
  "blues",
  "reggae",
  "country",
  "metal",
  "funk",
  "soul",
  "r-n-b",
  "latin",
  "electronic",
  "ambient",
  "folk",
  "hip-hop",
  "punk",
  "disco",
  "world-music",
  "bossa-nova",
  "gospel",
  "ska",
];

/**
 * Find tracks from genres the user does NOT usually listen to.
 *
 * Picks genres that are absent from the user's topGenres and
 * searches Spotify for tracks in those surprise genres.
 */
export async function findSurpriseTracks(
  client: SpotifyClient,
  topGenres: string[],
  excludeIds: Set<string>,
  count = 5,
): Promise<Track[]> {
  const collected: Track[] = [];
  const seen = new Set(excludeIds);

  const topSet = new Set(topGenres.map((g) => g.toLowerCase()));
  const surpriseGenres = ALL_GENRES.filter((g) => !topSet.has(g));

  // Shuffle deterministically-ish by taking from the front
  for (const genre of surpriseGenres) {
    if (collected.length >= count) break;

    const results = await client.searchTracks(`genre:${genre}`, count);
    for (const st of results) {
      if (collected.length >= count) break;
      if (seen.has(st.id)) continue;
      seen.add(st.id);
      collected.push(toTrack(st));
    }
  }

  return collected.slice(0, count);
}

export { ALL_GENRES };
