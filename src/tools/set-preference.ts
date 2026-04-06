import type Database from "better-sqlite3";
import {
  addPreference,
  listActivePreferences,
} from "../db/preferences.js";

export async function handleSetPreference(
  args: { preference: string },
  db: Database.Database,
) {
  // Parse the natural language preference into a structured rule
  const parsedRule = parsePreference(args.preference);

  const record = addPreference(db, {
    rule: args.preference,
    parsed_rule: JSON.stringify(parsedRule),
  });

  const activePreferences = listActivePreferences(db);

  return {
    parsed_rule: parsedRule,
    active_preferences: activePreferences.map((p) => ({
      id: p.id,
      rule: p.rule,
      parsed_rule: JSON.parse(p.parsed_rule),
    })),
  };
}

function parsePreference(preference: string): Record<string, unknown> {
  const lower = preference.toLowerCase();

  // Detect common preference patterns
  if (lower.includes("no ") || lower.includes("exclude") || lower.includes("avoid")) {
    return { type: "exclude", raw: preference };
  }
  if (lower.includes("more ") || lower.includes("prefer") || lower.includes("favor")) {
    return { type: "prefer", raw: preference };
  }
  if (lower.includes("only ") || lower.includes("limit")) {
    return { type: "restrict", raw: preference };
  }
  if (lower.includes("mix") || lower.includes("blend") || lower.includes("variety")) {
    return { type: "variety", raw: preference };
  }

  return { type: "general", raw: preference };
}
