import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRecommendations } from "../../src/recommender/engine";
import type { SpotifyClient } from "../../src/spotify/client";
import type { ApiAvailability } from "../../src/types";
import type Database from "better-sqlite3";

// Mock the DB module
vi.mock("../../src/db/recommendations", () => ({
  getRecommendedTrackIds: vi.fn().mockReturnValue([]),
}));

import { getRecommendedTrackIds } from "../../src/db/recommendations";

function makeSpotifyTrack(id: string, name: string) {
  return {
    id,
    name,
    artists: [{ name: "Artist" }],
    album: { name: "Album" },
    duration_ms: 200000,
    preview_url: null,
    uri: `spotify:track:${id}`,
  };
}

const defaultApi: ApiAvailability = {
  relatedArtists: true,
  search: true,
  featuredPlaylists: true,
  newReleases: true,
};

function makeClient(): SpotifyClient {
  return {
    getRelatedArtists: vi.fn().mockResolvedValue([
      { id: "rel1", name: "Related1", genres: [], images: [] },
    ]),
    getArtistTopTracks: vi.fn().mockResolvedValue([
      makeSpotifyTrack("sim1", "Similar 1"),
      makeSpotifyTrack("sim2", "Similar 2"),
      makeSpotifyTrack("sim3", "Similar 3"),
      makeSpotifyTrack("sim4", "Similar 4"),
      makeSpotifyTrack("sim5", "Similar 5"),
      makeSpotifyTrack("sim6", "Similar 6"),
    ]),
    getFeaturedPlaylists: vi.fn().mockResolvedValue([
      { id: "pl1", name: "Featured", description: "" },
    ]),
    getPlaylistTracks: vi.fn().mockResolvedValue([
      makeSpotifyTrack("cur1", "Curated 1"),
      makeSpotifyTrack("cur2", "Curated 2"),
      makeSpotifyTrack("cur3", "Curated 3"),
    ]),
    getNewReleases: vi.fn().mockResolvedValue([]),
    searchTracks: vi.fn().mockResolvedValue([
      makeSpotifyTrack("sur1", "Surprise 1"),
      makeSpotifyTrack("sur2", "Surprise 2"),
    ]),
  } as unknown as SpotifyClient;
}

const mockDb = {} as Database.Database;

describe("getRecommendations", () => {
  beforeEach(() => {
    vi.mocked(getRecommendedTrackIds).mockReturnValue([]);
  });

  it("returns similar tracks when strategy is 'similar'", async () => {
    const client = makeClient();
    const result = await getRecommendations(
      client,
      mockDb,
      {
        strategy: "similar",
        count: 5,
        seedArtistIds: ["a1"],
        topGenres: ["pop"],
      },
      defaultApi,
    );

    expect(result.strategy_used).toBe("similar");
    expect(result.tracks.length).toBeGreaterThan(0);
    expect(result.tracks[0].id).toBe("sim1");
  });

  it("returns curated tracks when strategy is 'curated'", async () => {
    const client = makeClient();
    const result = await getRecommendations(
      client,
      mockDb,
      {
        strategy: "curated",
        count: 5,
        seedArtistIds: ["a1"],
        topGenres: ["pop"],
      },
      defaultApi,
    );

    expect(result.strategy_used).toBe("curated");
    expect(result.tracks.length).toBeGreaterThan(0);
    expect(result.tracks[0].id).toBe("cur1");
  });

  it("returns surprise tracks when strategy is 'surprise'", async () => {
    const client = makeClient();
    const result = await getRecommendations(
      client,
      mockDb,
      {
        strategy: "surprise",
        count: 5,
        seedArtistIds: ["a1"],
        topGenres: ["pop"],
      },
      defaultApi,
    );

    expect(result.strategy_used).toBe("surprise");
    expect(result.tracks.length).toBeGreaterThan(0);
    expect(result.tracks[0].id).toBe("sur1");
  });

  it("auto strategy mixes all three strategies", async () => {
    const client = makeClient();
    const result = await getRecommendations(
      client,
      mockDb,
      {
        strategy: "auto",
        count: 10,
        seedArtistIds: ["a1"],
        topGenres: ["pop"],
      },
      defaultApi,
    );

    expect(result.strategy_used).toBe("auto");

    // Should contain tracks from all three strategies
    const ids = result.tracks.map((t) => t.id);
    const hasSimilar = ids.some((id) => id.startsWith("sim"));
    const hasCurated = ids.some((id) => id.startsWith("cur"));
    const hasSurprise = ids.some((id) => id.startsWith("sur"));

    expect(hasSimilar).toBe(true);
    expect(hasCurated).toBe(true);
    expect(hasSurprise).toBe(true);
  });

  it("auto strategy reason shows breakdown", async () => {
    const client = makeClient();
    const result = await getRecommendations(
      client,
      mockDb,
      {
        strategy: "auto",
        count: 10,
        seedArtistIds: ["a1"],
        topGenres: ["pop"],
      },
      defaultApi,
    );

    expect(result.reason).toContain("similar");
    expect(result.reason).toContain("curated");
    expect(result.reason).toContain("surprise");
  });

  it("dedup excludes previously recommended tracks", async () => {
    vi.mocked(getRecommendedTrackIds).mockReturnValue(["sim1", "sim2"]);

    const client = makeClient();
    const result = await getRecommendations(
      client,
      mockDb,
      {
        strategy: "similar",
        count: 5,
        seedArtistIds: ["a1"],
        topGenres: ["pop"],
      },
      defaultApi,
    );

    const ids = result.tracks.map((t) => t.id);
    expect(ids).not.toContain("sim1");
    expect(ids).not.toContain("sim2");
  });

  it("auto strategy dedup across strategies", async () => {
    const client = makeClient();
    const result = await getRecommendations(
      client,
      mockDb,
      {
        strategy: "auto",
        count: 10,
        seedArtistIds: ["a1"],
        topGenres: ["pop"],
      },
      defaultApi,
    );

    // All track IDs should be unique
    const ids = result.tracks.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});
