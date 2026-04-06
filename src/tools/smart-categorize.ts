import type Database from "better-sqlite3";
import type { SpotifyClient } from "../spotify/client.js";
import { createPlaylist } from "../db/playlists.js";

export async function handleSmartCategorize(
  args: { create_playlists?: boolean },
  client: SpotifyClient,
  db: Database.Database,
) {
  const topArtists = await client.getTopArtists("medium_term", 50);
  const topTracks = await client.getTopTracks("medium_term", 50);

  // Group tracks by genre
  const genreMap = new Map<string, typeof topTracks>();

  // Build artist-to-genres mapping
  const artistGenres = new Map<string, string[]>();
  for (const artist of topArtists) {
    artistGenres.set(artist.name.toLowerCase(), artist.genres);
  }

  for (const track of topTracks) {
    const trackArtist = track.artists[0]?.name.toLowerCase() ?? "";
    const genres = artistGenres.get(trackArtist) ?? ["uncategorized"];
    const primaryGenre = genres[0] ?? "uncategorized";

    if (!genreMap.has(primaryGenre)) {
      genreMap.set(primaryGenre, []);
    }
    genreMap.get(primaryGenre)!.push(track);
  }

  // Build categories sorted by track count
  const categories = [...genreMap.entries()]
    .map(([genre, tracks]) => ({
      category: genre,
      track_count: tracks.length,
      sample_tracks: tracks.slice(0, 3).map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
      })),
    }))
    .sort((a, b) => b.track_count - a.track_count);

  // Optionally create playlists for each category
  const createdPlaylists: { category: string; playlist_id: string }[] = [];
  if (args.create_playlists) {
    const user = await client.getCurrentUser();
    for (const cat of categories) {
      if (cat.track_count < 2) continue; // Skip categories with too few tracks

      const playlistName = `DJ Category: ${cat.category}`;
      const spotifyId = await client.createPlaylist(
        user.id,
        playlistName,
        `Auto-categorized: ${cat.category}`,
        false,
      );

      const trackUris = genreMap
        .get(cat.category)!
        .map((t) => t.uri);
      await client.addTracksToPlaylist(spotifyId, trackUris);

      createPlaylist(db, {
        spotify_id: spotifyId,
        name: playlistName,
        description: `Auto-categorized: ${cat.category}`,
      });

      createdPlaylists.push({ category: cat.category, playlist_id: spotifyId });
    }
  }

  return {
    categories,
    created_playlists: createdPlaylists,
  };
}
