import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../../src/db/schema";
import { upsertTrack } from "../../src/db/tracks";
import { addRecommendation } from "../../src/db/recommendations";
import { createPlaylist } from "../../src/db/playlists";
import { handlePreviewTracks } from "../../src/tools/preview-tracks";
import type { SpotifyClient } from "../../src/spotify/client";

function makeClient(): SpotifyClient {
  return {
    addTracksToPlaylist: vi.fn().mockResolvedValue(undefined),
  } as unknown as SpotifyClient;
}

describe("handlePreviewTracks", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    initSchema(db);

    // Seed tracks
    upsertTrack(db, { id: "t1", name: "Track 1", artist: "A1", album: "Al1", duration_ms: 200000, genre_tags: [], language: null });
    upsertTrack(db, { id: "t2", name: "Track 2", artist: "A2", album: "Al2", duration_ms: 180000, genre_tags: [], language: null });
  });

  it("updates recommendation status to accepted", async () => {
    const rec1 = addRecommendation(db, { track_id: "t1", strategy: "similar" });
    const rec2 = addRecommendation(db, { track_id: "t2", strategy: "similar" });
    const client = makeClient();

    const result = await handlePreviewTracks(
      { track_ids: ["t1", "t2"], action: "accept" },
      client,
      db,
    );

    expect(result.action).toBe("accept");
    expect(result.tracks_processed).toBe(2);
    expect(result.track_ids).toContain("t1");
    expect(result.track_ids).toContain("t2");

    // Check DB
    const updated1 = db.prepare("SELECT status FROM recommendations WHERE id = ?").get(rec1.id) as { status: string };
    const updated2 = db.prepare("SELECT status FROM recommendations WHERE id = ?").get(rec2.id) as { status: string };
    expect(updated1.status).toBe("accepted");
    expect(updated2.status).toBe("accepted");

    // Should NOT have called addTracksToPlaylist for plain accept
    expect(client.addTracksToPlaylist).not.toHaveBeenCalled();
  });

  it("updates recommendation status to rejected", async () => {
    const rec = addRecommendation(db, { track_id: "t1", strategy: "curated" });
    const client = makeClient();

    const result = await handlePreviewTracks(
      { track_ids: ["t1"], action: "reject" },
      client,
      db,
    );

    expect(result.action).toBe("reject");
    expect(result.tracks_processed).toBe(1);

    const updated = db.prepare("SELECT status FROM recommendations WHERE id = ?").get(rec.id) as { status: string };
    expect(updated.status).toBe("rejected");
  });

  it("accept_to adds tracks to playlist", async () => {
    // Create a playlist in DB so the FK reference works
    const playlist = createPlaylist(db, { spotify_id: "sp_pl_1", name: "Test PL", description: null });
    addRecommendation(db, { track_id: "t1", strategy: "similar" });
    const client = makeClient();

    const result = await handlePreviewTracks(
      { track_ids: ["t1"], action: "accept_to", target_playlist_id: "sp_pl_1" },
      client,
      db,
    );

    expect(result.action).toBe("accept_to");
    expect(result.target_playlist_id).toBe("sp_pl_1");
    expect(result.tracks_processed).toBe(1);

    expect(client.addTracksToPlaylist).toHaveBeenCalledWith(
      "sp_pl_1",
      ["spotify:track:t1"],
    );

    // Check recommendation has internal playlist_id set
    const rec = db.prepare("SELECT status, playlist_id FROM recommendations WHERE track_id = ?").get("t1") as { status: string; playlist_id: string | null };
    expect(rec.status).toBe("accepted");
    expect(rec.playlist_id).toBe(playlist.id);
  });

  it("throws error for accept_to without target_playlist_id", async () => {
    addRecommendation(db, { track_id: "t1", strategy: "similar" });
    const client = makeClient();

    await expect(
      handlePreviewTracks(
        { track_ids: ["t1"], action: "accept_to" },
        client,
        db,
      ),
    ).rejects.toThrow("target_playlist_id is required");
  });

  it("only processes pending recommendations", async () => {
    const rec = addRecommendation(db, { track_id: "t1", strategy: "similar" });
    // Manually set to already accepted
    db.prepare("UPDATE recommendations SET status = 'accepted' WHERE id = ?").run(rec.id);
    const client = makeClient();

    const result = await handlePreviewTracks(
      { track_ids: ["t1"], action: "reject" },
      client,
      db,
    );

    // Should not have processed any since it's already accepted (not pending)
    expect(result.tracks_processed).toBe(0);
  });
});
