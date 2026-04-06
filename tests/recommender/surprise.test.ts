import { describe, it, expect, vi } from "vitest";
import { findSurpriseTracks, ALL_GENRES } from "../../src/recommender/surprise";
import type { SpotifyClient } from "../../src/spotify/client";

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

function makeClient(overrides: Partial<SpotifyClient> = {}): SpotifyClient {
  return {
    searchTracks: vi.fn(),
    ...overrides,
  } as unknown as SpotifyClient;
}

describe("findSurpriseTracks", () => {
  it("searches genres NOT in user's top genres", async () => {
    const searchTracks = vi.fn().mockResolvedValue([
      makeSpotifyTrack("t1", "Surprise Track"),
    ]);
    const client = makeClient({ searchTracks });

    // User listens to jazz and classical — should search OTHER genres
    const tracks = await findSurpriseTracks(
      client,
      ["jazz", "classical"],
      new Set(),
      1,
    );

    expect(tracks.length).toBe(1);
    // The first search call should NOT be for jazz or classical
    const calledGenre = searchTracks.mock.calls[0][0] as string;
    expect(calledGenre).not.toContain("jazz");
    expect(calledGenre).not.toContain("classical");
    expect(calledGenre).toMatch(/^genre:/);
  });

  it("filters out excludeIds", async () => {
    const client = makeClient({
      searchTracks: vi.fn().mockResolvedValue([
        makeSpotifyTrack("t1", "Track 1"),
        makeSpotifyTrack("t2", "Track 2"),
      ]),
    });

    const tracks = await findSurpriseTracks(
      client,
      [],
      new Set(["t1"]),
      5,
    );

    // t1 should be filtered out
    const ids = tracks.map((t) => t.id);
    expect(ids).not.toContain("t1");
    expect(ids).toContain("t2");
  });

  it("skips all user genres when filtering", async () => {
    const searchTracks = vi.fn().mockResolvedValue([]);
    const client = makeClient({ searchTracks });

    // If user listens to ALL genres, no surprise genres remain
    await findSurpriseTracks(client, ALL_GENRES, new Set(), 5);

    // searchTracks should never be called since there are no surprise genres
    expect(searchTracks).not.toHaveBeenCalled();
  });

  it("respects count limit", async () => {
    const client = makeClient({
      searchTracks: vi.fn().mockResolvedValue([
        makeSpotifyTrack("t1", "Track 1"),
        makeSpotifyTrack("t2", "Track 2"),
        makeSpotifyTrack("t3", "Track 3"),
      ]),
    });

    const tracks = await findSurpriseTracks(
      client,
      [],
      new Set(),
      2,
    );

    expect(tracks.length).toBe(2);
  });
});
