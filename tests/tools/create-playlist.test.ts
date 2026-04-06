import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../../src/db/schema";
import { handleCreatePlaylist } from "../../src/tools/create-playlist";
import type { SpotifyClient, SpotifyTrack } from "../../src/spotify/client";

function makeSpotifyTrack(id: string, name: string): SpotifyTrack {
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

function makeClient(searchResults: SpotifyTrack[] = []): SpotifyClient {
  return {
    searchTracks: vi.fn().mockResolvedValue(searchResults),
    getCurrentUser: vi.fn().mockResolvedValue({ id: "user1", display_name: "Test" }),
    createPlaylist: vi.fn().mockResolvedValue("sp_playlist_1"),
    addTracksToPlaylist: vi.fn().mockResolvedValue(undefined),
  } as unknown as SpotifyClient;
}

describe("handleCreatePlaylist", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  });

  it("creates a playlist and saves to DB", async () => {
    const tracks = [
      makeSpotifyTrack("t1", "Track 1"),
      makeSpotifyTrack("t2", "Track 2"),
    ];
    const client = makeClient(tracks);

    const result = await handleCreatePlaylist(
      { description: "chill vibes" },
      client,
      db,
    );

    expect(result.playlist_id).toBe("sp_playlist_1");
    expect(result.name).toBe("DJ: chill vibes");
    expect(result.track_count).toBe(2);
    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0].id).toBe("t1");

    // Verify DB records
    const playlists = db
      .prepare("SELECT * FROM playlists")
      .all() as { spotify_id: string; name: string }[];
    expect(playlists).toHaveLength(1);
    expect(playlists[0].spotify_id).toBe("sp_playlist_1");

    const dbTracks = db
      .prepare("SELECT * FROM tracks")
      .all() as { id: string }[];
    expect(dbTracks).toHaveLength(2);

    const links = db
      .prepare("SELECT * FROM playlist_tracks")
      .all() as { playlist_id: string; track_id: string }[];
    expect(links).toHaveLength(2);

    // Verify Spotify API calls
    expect(client.searchTracks).toHaveBeenCalledWith("chill vibes", 20);
    expect(client.createPlaylist).toHaveBeenCalledWith(
      "user1",
      "DJ: chill vibes",
      "chill vibes",
      false,
    );
    expect(client.addTracksToPlaylist).toHaveBeenCalledWith(
      "sp_playlist_1",
      ["spotify:track:t1", "spotify:track:t2"],
    );
  });

  it("returns suggestion when search returns empty", async () => {
    const client = makeClient([]);

    const result = await handleCreatePlaylist(
      { description: "nonexistent music style 12345" },
      client,
      db,
    );

    expect(result.playlist_id).toBeNull();
    expect(result.tracks).toHaveLength(0);
    expect(result.track_count).toBe(0);
    expect(result.suggestion).toBe("Try broadening your description");

    // Should not have called createPlaylist
    expect(client.createPlaylist).not.toHaveBeenCalled();
  });

  it("respects track_count and public options", async () => {
    const tracks = [makeSpotifyTrack("t1", "Track 1")];
    const client = makeClient(tracks);

    await handleCreatePlaylist(
      { description: "party music", track_count: 5, public: true },
      client,
      db,
    );

    expect(client.searchTracks).toHaveBeenCalledWith("party music", 5);
    expect(client.createPlaylist).toHaveBeenCalledWith(
      "user1",
      "DJ: party music",
      "party music",
      true,
    );
  });
});
