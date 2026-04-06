import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { initSchema } from "../../src/db/schema";
import { createPlaylist, getPlaylist, listPlaylists, deletePlaylist } from "../../src/db/playlists";

describe("schema", () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(":memory:"); initSchema(db); });
  it("creates all tables", () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("playlists");
    expect(names).toContain("tracks");
    expect(names).toContain("playlist_tracks");
    expect(names).toContain("recommendations");
    expect(names).toContain("preferences");
    expect(names).toContain("schedules");
  });
});

describe("playlists CRUD", () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(":memory:"); initSchema(db); });
  it("creates and retrieves a playlist", () => {
    const p = createPlaylist(db, { spotify_id: "sp123", name: "Chill", description: "relaxing" });
    expect(p.spotify_id).toBe("sp123");
    const fetched = getPlaylist(db, p.id);
    expect(fetched?.name).toBe("Chill");
  });
  it("lists all playlists", () => {
    createPlaylist(db, { spotify_id: "sp1", name: "A", description: null });
    createPlaylist(db, { spotify_id: "sp2", name: "B", description: null });
    expect(listPlaylists(db)).toHaveLength(2);
  });
  it("deletes a playlist", () => {
    const p = createPlaylist(db, { spotify_id: "sp1", name: "A", description: null });
    deletePlaylist(db, p.id);
    expect(getPlaylist(db, p.id)).toBeUndefined();
  });
});
