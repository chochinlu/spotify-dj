import { describe, it, expect, vi } from "vitest";
import { findCuratedTracks } from "../../src/recommender/curated";
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
    getFeaturedPlaylists: vi.fn(),
    getPlaylistTracks: vi.fn(),
    getNewReleases: vi.fn().mockResolvedValue([]),
    searchTracks: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as SpotifyClient;
}

describe("findCuratedTracks", () => {
  it("fetches tracks from featured playlists", async () => {
    const client = makeClient({
      getFeaturedPlaylists: vi.fn().mockResolvedValue([
        { id: "pl1", name: "Playlist 1", description: "" },
        { id: "pl2", name: "Playlist 2", description: "" },
      ]),
      getPlaylistTracks: vi.fn()
        .mockResolvedValueOnce([
          makeSpotifyTrack("t1", "Track 1"),
          makeSpotifyTrack("t2", "Track 2"),
        ])
        .mockResolvedValueOnce([
          makeSpotifyTrack("t3", "Track 3"),
        ]),
    });

    const tracks = await findCuratedTracks(
      client,
      ["pop"],
      new Set(),
      10,
    );

    expect(client.getFeaturedPlaylists).toHaveBeenCalled();
    expect(client.getPlaylistTracks).toHaveBeenCalledWith("pl1");
    expect(client.getPlaylistTracks).toHaveBeenCalledWith("pl2");
    expect(tracks.length).toBe(3);
    expect(tracks[0].id).toBe("t1");
    expect(tracks[2].id).toBe("t3");
  });

  it("filters out excludeIds", async () => {
    const client = makeClient({
      getFeaturedPlaylists: vi.fn().mockResolvedValue([
        { id: "pl1", name: "Playlist 1", description: "" },
      ]),
      getPlaylistTracks: vi.fn().mockResolvedValue([
        makeSpotifyTrack("t1", "Track 1"),
        makeSpotifyTrack("t2", "Track 2"),
        makeSpotifyTrack("t3", "Track 3"),
      ]),
    });

    const tracks = await findCuratedTracks(
      client,
      ["pop"],
      new Set(["t1", "t3"]),
      10,
    );

    expect(tracks.length).toBe(1);
    expect(tracks[0].id).toBe("t2");
  });

  it("respects count limit", async () => {
    const client = makeClient({
      getFeaturedPlaylists: vi.fn().mockResolvedValue([
        { id: "pl1", name: "Playlist 1", description: "" },
      ]),
      getPlaylistTracks: vi.fn().mockResolvedValue([
        makeSpotifyTrack("t1", "Track 1"),
        makeSpotifyTrack("t2", "Track 2"),
        makeSpotifyTrack("t3", "Track 3"),
        makeSpotifyTrack("t4", "Track 4"),
      ]),
    });

    const tracks = await findCuratedTracks(
      client,
      ["pop"],
      new Set(),
      2,
    );

    expect(tracks.length).toBe(2);
  });

  it("deduplicates tracks across playlists", async () => {
    const client = makeClient({
      getFeaturedPlaylists: vi.fn().mockResolvedValue([
        { id: "pl1", name: "Playlist 1", description: "" },
        { id: "pl2", name: "Playlist 2", description: "" },
      ]),
      getPlaylistTracks: vi.fn()
        .mockResolvedValueOnce([
          makeSpotifyTrack("t1", "Track 1"),
        ])
        .mockResolvedValueOnce([
          makeSpotifyTrack("t1", "Track 1"),  // duplicate
          makeSpotifyTrack("t2", "Track 2"),
        ]),
    });

    const tracks = await findCuratedTracks(
      client,
      ["pop"],
      new Set(),
      10,
    );

    expect(tracks.length).toBe(2);
    expect(tracks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });
});
