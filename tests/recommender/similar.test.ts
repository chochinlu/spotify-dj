import { describe, it, expect, vi } from "vitest";
import { findSimilarTracks } from "../../src/recommender/similar";
import type { SpotifyClient } from "../../src/spotify/client";
import type { ApiAvailability } from "../../src/types";

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
    getRelatedArtists: vi.fn(),
    getArtistTopTracks: vi.fn(),
    searchTracks: vi.fn(),
    ...overrides,
  } as unknown as SpotifyClient;
}

describe("findSimilarTracks", () => {
  it("uses relatedArtists + getArtistTopTracks when available", async () => {
    const client = makeClient({
      getRelatedArtists: vi.fn().mockResolvedValue([
        { id: "rel1", name: "Related1", genres: [], images: [] },
      ]),
      getArtistTopTracks: vi.fn().mockResolvedValue([
        makeSpotifyTrack("t1", "Track 1"),
        makeSpotifyTrack("t2", "Track 2"),
      ]),
    });

    const api: ApiAvailability = {
      relatedArtists: true,
      search: true,
      featuredPlaylists: true,
      newReleases: true,
    };

    const tracks = await findSimilarTracks(
      client,
      ["seed1"],
      api,
      new Set(),
      ["pop"],
      5,
    );

    expect(client.getRelatedArtists).toHaveBeenCalledWith("seed1");
    expect(client.getArtistTopTracks).toHaveBeenCalledWith("rel1");
    expect(tracks.length).toBe(2);
    expect(tracks[0]).toEqual({
      id: "t1",
      name: "Track 1",
      artist: "Artist",
      album: "Album",
      duration_ms: 200000,
      preview_url: null,
    });
  });

  it("falls back to genre search when relatedArtists unavailable", async () => {
    const client = makeClient({
      searchTracks: vi.fn().mockResolvedValue([
        makeSpotifyTrack("t3", "Genre Track"),
      ]),
    });

    const api: ApiAvailability = {
      relatedArtists: false,
      search: true,
      featuredPlaylists: true,
      newReleases: true,
    };

    const tracks = await findSimilarTracks(
      client,
      ["seed1"],
      api,
      new Set(),
      ["rock", "pop"],
      5,
    );

    expect(client.searchTracks).toHaveBeenCalledWith("genre:rock", 5);
    expect(tracks.length).toBe(1);
    expect(tracks[0].name).toBe("Genre Track");
  });

  it("filters out excludeIds", async () => {
    const client = makeClient({
      getRelatedArtists: vi.fn().mockResolvedValue([
        { id: "rel1", name: "Related1", genres: [], images: [] },
      ]),
      getArtistTopTracks: vi.fn().mockResolvedValue([
        makeSpotifyTrack("t1", "Track 1"),
        makeSpotifyTrack("t2", "Track 2"),
      ]),
    });

    const api: ApiAvailability = {
      relatedArtists: true,
      search: true,
      featuredPlaylists: true,
      newReleases: true,
    };

    const tracks = await findSimilarTracks(
      client,
      ["seed1"],
      api,
      new Set(["t1"]),
      [],
      5,
    );

    expect(tracks.length).toBe(1);
    expect(tracks[0].id).toBe("t2");
  });

  it("returns empty array when no API is available", async () => {
    const client = makeClient();
    const api: ApiAvailability = {
      relatedArtists: false,
      search: false,
      featuredPlaylists: false,
      newReleases: false,
    };

    const tracks = await findSimilarTracks(
      client,
      ["seed1"],
      api,
      new Set(),
      [],
      5,
    );

    expect(tracks).toEqual([]);
  });
});
