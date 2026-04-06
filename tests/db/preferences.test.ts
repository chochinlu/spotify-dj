import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { initSchema } from "../../src/db/schema";
import { addPreference, listActivePreferences, deactivatePreference } from "../../src/db/preferences";

describe("preferences", () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(":memory:"); initSchema(db); });
  it("adds and lists active preferences", () => {
    addPreference(db, { rule: "no kpop", parsed_rule: '{"exclude_genre":"kpop"}' });
    const prefs = listActivePreferences(db);
    expect(prefs).toHaveLength(1);
    expect(prefs[0].rule).toBe("no kpop");
  });
  it("deactivates a preference", () => {
    const p = addPreference(db, { rule: "no kpop", parsed_rule: '{}' });
    deactivatePreference(db, p.id);
    expect(listActivePreferences(db)).toHaveLength(0);
  });
});
