import type { SpotifyClient } from "../spotify/client.js";

export async function handleAnalyzeListening(
  args: { time_range?: string },
  client: SpotifyClient,
) {
  const timeRange = args.time_range ?? "medium_term";

  const [topArtists, topTracks] = await Promise.all([
    client.getTopArtists(timeRange, 50),
    client.getTopTracks(timeRange, 50),
  ]);

  // Aggregate genres
  const genreCounts = new Map<string, number>();
  for (const artist of topArtists) {
    for (const genre of artist.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([genre, count]) => ({ genre, artist_count: count }));

  // Suggested categories based on top genres
  const suggestedCategories = topGenres.slice(0, 5).map((g) => g.genre);

  return {
    top_genres: topGenres,
    top_artists: topArtists.slice(0, 20).map((a) => ({
      id: a.id,
      name: a.name,
      genres: a.genres,
    })),
    listening_patterns: {
      time_range: timeRange,
      top_tracks: topTracks.slice(0, 20).map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        album: t.album.name,
      })),
      total_artists_analyzed: topArtists.length,
      total_tracks_analyzed: topTracks.length,
    },
    suggested_categories: suggestedCategories,
  };
}
