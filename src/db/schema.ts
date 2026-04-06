import type Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id            TEXT PRIMARY KEY,
      spotify_id    TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      description   TEXT,
      auto_update   INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tracks (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      artist        TEXT NOT NULL,
      album         TEXT,
      duration_ms   INTEGER,
      genre_tags    TEXT,
      language      TEXT,
      added_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id   TEXT REFERENCES playlists(id),
      track_id      TEXT REFERENCES tracks(id),
      added_at      TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (playlist_id, track_id)
    );
    CREATE TABLE IF NOT EXISTS recommendations (
      id            TEXT PRIMARY KEY,
      track_id      TEXT REFERENCES tracks(id),
      strategy      TEXT NOT NULL,
      status        TEXT DEFAULT 'pending',
      playlist_id   TEXT REFERENCES playlists(id),
      created_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS preferences (
      id            TEXT PRIMARY KEY,
      rule          TEXT NOT NULL,
      parsed_rule   TEXT NOT NULL,
      active        INTEGER DEFAULT 1,
      created_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS schedules (
      id            TEXT PRIMARY KEY,
      playlist_id   TEXT REFERENCES playlists(id),
      cron          TEXT NOT NULL,
      strategy      TEXT DEFAULT 'auto',
      enabled       INTEGER DEFAULT 1,
      last_run      TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );
  `);
}
