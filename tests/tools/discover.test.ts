import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SpotifyClient } from "../../src/spotify/client";
import type { ApiAvailability } from "../../src/types";
import type Database from "better-sqlite3";

// Mock the engine module
vi.mock("../../src/recommender/engine", () => ({
  getRecommendations: vi.fn().mockResolvedValue({
    tracks: [
      { id: "r1", name: "Rec 1", artist: "A1", album: "Al1", duration_ms: 200000, preview_url: null },
      { id: "r2", name: "Rec 2", artist: "A2", album: "Al2", duration_ms: 180000, preview_url: null },
    ],
    strategy_used: "similar",
    reason: "Finding tracks from artists related to your favorites.",
  }),
}));

// Mock DB modules
vi.mock("../../src/db/recommendations", () => ({
  addRecommendation: vi.fn().mockReturnValue({ id: "rec1", track_id: "r1", strategy: "similar", status: "pending", playlist_id: null, created_at: "" }),
}));

vi.mock("../../src/db/tracks", () => ({
  upsertTracks: vi.fn(),
}));

import { handleDiscover } from "../../src/tools/discover";
import { getRecommendations } from "../../src/recommender/engine";
import { addRecommendation } from "../../src/db/recommendations";
import { upsertTracks } from "../../src/db/tracks";

const defaultApi: ApiAvailability = {
  relatedArtists: true,
  search: true,
  featuredPlaylists: true,
  newReleases: true,
};

function makeClient(): SpotifyClient {
  return {
    getTopArtists: vi.fn().mockResolvedValue([
      { id: "a1", name: "Artist 1", genres: ["pop", "rock"], images: [] },
      { id: "a2", name: "Artist 2", genres: ["rock", "indie"], images: [] },
    ]),
    getTopTracks: vi.fn().mockResolvedValue([]),
  } as unknown as SpotifyClient;
}

const mockDb = {} as Database.Database;

describe("handleDiscover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to engine with correct options", async () => {
    const client = makeClient();

    const result = await handleDiscover(
      { strategy: "similar" },
      client,
      mockDb,
      defaultApi,
    );

    expect(getRecommendations).toHaveBeenCalledWith(
      client,
      mockDb,
      expect.objectContaining({
        strategy: "similar",
        count: 10,
        seedArtistIds: ["a1", "a2"],
        topGenres: expect.arrayContaining(["rock", "pop"]),
      }),
      defaultApi,
    );

    expect(result.strategy_used).toBe("similar");
    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0].id).toBe("r1");
    expect(result.reason).toBeTruthy();
  });

  it("saves tracks to DB and records recommendations", async () => {
    const client = makeClient();

    await handleDiscover(
      { strategy: "curated", count: 5 },
      client,
      mockDb,
      defaultApi,
    );

    expect(upsertTracks).toHaveBeenCalledWith(
      mockDb,
      expect.arrayContaining([
        expect.objectContaining({ id: "r1", name: "Rec 1" }),
      ]),
    );

    // addRecommendation called for each track
    expect(addRecommendation).toHaveBeenCalledTimes(2);
    expect(addRecommendation).toHaveBeenCalledWith(mockDb, {
      track_id: "r1",
      strategy: "similar",
    });
  });

  it("respects custom count", async () => {
    const client = makeClient();

    await handleDiscover(
      { strategy: "auto", count: 25 },
      client,
      mockDb,
      defaultApi,
    );

    expect(getRecommendations).toHaveBeenCalledWith(
      client,
      mockDb,
      expect.objectContaining({ count: 25 }),
      defaultApi,
    );
  });

  it("computes top genres from artist data", async () => {
    const client = makeClient();

    await handleDiscover(
      { strategy: "similar" },
      client,
      mockDb,
      defaultApi,
    );

    // "rock" appears in both artists (count 2), "pop" and "indie" in one each
    const callArgs = vi.mocked(getRecommendations).mock.calls[0][2];
    expect(callArgs.topGenres[0]).toBe("rock"); // highest count
  });
});
