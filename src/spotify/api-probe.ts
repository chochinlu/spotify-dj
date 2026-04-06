import type { SpotifyClient } from "./client.js";
import type { ApiAvailability } from "../types.js";

export async function probeApiAvailability(
  client: SpotifyClient,
): Promise<ApiAvailability> {
  const probe = async (fn: () => Promise<unknown>): Promise<boolean> => {
    try {
      await fn();
      return true;
    } catch {
      return false;
    }
  };

  return {
    relatedArtists: await probe(() =>
      client.getRelatedArtists("4NHQUGzhtTLFvgF5SZesLK"),
    ),
    search: await probe(() => client.searchTracks("test", 1)),
    featuredPlaylists: await probe(() => client.getFeaturedPlaylists()),
    newReleases: await probe(() => client.getNewReleases()),
  };
}
