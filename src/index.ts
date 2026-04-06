import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getDb } from "./db/connection.js";
import { getAccessToken, AuthExpiredError } from "./spotify/auth.js";
import { SpotifyClient } from "./spotify/client.js";
import { probeApiAvailability } from "./spotify/api-probe.js";
import { findDueSchedules } from "./scheduler/checker.js";
import { handleCreatePlaylist } from "./tools/create-playlist.js";
import { handleUpdatePlaylist } from "./tools/update-playlist.js";
import { handleListPlaylists } from "./tools/list-playlists.js";
import { handleDeletePlaylist } from "./tools/delete-playlist.js";
import { handleDiscover } from "./tools/discover.js";
import { handlePreviewTracks } from "./tools/preview-tracks.js";
import { handleAnalyzeListening } from "./tools/analyze-listening.js";
import { handleSetPreference } from "./tools/set-preference.js";
import { handleSmartCategorize } from "./tools/smart-categorize.js";
import { handleScheduleUpdate } from "./tools/schedule-update.js";
import { handleListSchedules } from "./tools/list-schedules.js";
import { handleRunNow } from "./tools/run-now.js";

const server = new McpServer({ name: "spotify-dj", version: "1.0.0" });

async function main() {
  const db = getDb();
  let accessToken: string;
  try {
    accessToken = await getAccessToken(
      process.env.SPOTIFY_CLIENT_ID!,
      process.env.SPOTIFY_CLIENT_SECRET!,
    );
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      console.error(
        "Spotify auth expired. Delete data/tokens.json and restart to re-authorize.",
      );
      process.exit(1);
    }
    throw err;
  }
  const client = new SpotifyClient(accessToken);
  const apiAvailability = await probeApiAvailability(client);

  // --- Tool registrations ---

  server.tool(
    "create_playlist",
    "Create a Spotify playlist from a natural language description",
    {
      description: z
        .string()
        .describe("Natural language playlist description"),
      track_count: z
        .number()
        .optional()
        .describe("Target track count (default 20)"),
      public: z
        .boolean()
        .optional()
        .describe("Public playlist (default false)"),
    },
    async (args) => {
      try {
        const result = await handleCreatePlaylist(args, client, db);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "update_playlist",
    "Update a Spotify playlist by adding, removing, or refreshing tracks",
    {
      playlist_id: z.string().describe("Spotify playlist ID"),
      action: z
        .enum(["add", "remove", "refresh"])
        .describe("Action to perform"),
      description: z
        .string()
        .optional()
        .describe("Search description for add/refresh"),
      track_ids: z
        .array(z.string())
        .optional()
        .describe("Track IDs to remove"),
    },
    async (args) => {
      try {
        const result = await handleUpdatePlaylist(args, client, db);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "list_playlists",
    "List all managed playlists",
    {},
    async () => {
      try {
        const result = await handleListPlaylists(db);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "delete_playlist",
    "Delete a managed playlist from Spotify and local DB",
    {
      playlist_id: z.string().describe("Spotify playlist ID to delete"),
    },
    async (args) => {
      try {
        const result = await handleDeletePlaylist(args, client, db);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "discover",
    "Discover new music using recommendation strategies",
    {
      strategy: z
        .enum(["similar", "curated", "surprise", "auto"])
        .describe("Recommendation strategy"),
      count: z
        .number()
        .optional()
        .describe("Number of tracks to discover (default 10)"),
      seed_playlist_id: z
        .string()
        .optional()
        .describe("Playlist ID to use as seed"),
    },
    async (args) => {
      try {
        const result = await handleDiscover(
          args,
          client,
          db,
          apiAvailability,
        );
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "preview_tracks",
    "Accept or reject discovered tracks, optionally adding them to a playlist",
    {
      track_ids: z.array(z.string()).describe("Track IDs to process"),
      action: z
        .enum(["accept", "reject", "accept_to"])
        .describe("Action to perform"),
      target_playlist_id: z
        .string()
        .optional()
        .describe("Target playlist ID for accept_to action"),
    },
    async (args) => {
      try {
        const result = await handlePreviewTracks(args, client, db);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "analyze_listening",
    "Analyze listening habits and return structured data about top genres, artists, and patterns",
    {
      time_range: z
        .string()
        .optional()
        .describe(
          "Time range: short_term, medium_term, or long_term (default medium_term)",
        ),
    },
    async (args) => {
      try {
        const result = await handleAnalyzeListening(args, client);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "set_preference",
    "Save a natural language music preference rule",
    {
      preference: z
        .string()
        .describe("Natural language preference (e.g. 'no country music')"),
    },
    async (args) => {
      try {
        const result = await handleSetPreference(args, db);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "smart_categorize",
    "Categorize listening history by genre and optionally create playlists",
    {
      create_playlists: z
        .boolean()
        .optional()
        .describe("Whether to create Spotify playlists for categories"),
    },
    async (args) => {
      try {
        const result = await handleSmartCategorize(args, client, db);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "schedule_update",
    "Create a scheduled automatic playlist update",
    {
      playlist_id: z
        .string()
        .describe("Internal playlist ID to schedule updates for"),
      cron: z.string().describe("Cron expression for schedule timing"),
      strategy: z
        .string()
        .optional()
        .describe(
          "Recommendation strategy: similar, curated, surprise, or auto (default auto)",
        ),
      enabled: z
        .boolean()
        .optional()
        .describe("Whether the schedule is enabled (default true)"),
    },
    async (args) => {
      try {
        const result = await handleScheduleUpdate(args, db);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "list_schedules",
    "List all scheduled playlist updates with their next run times",
    {},
    async () => {
      try {
        const result = await handleListSchedules(db);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "run_now",
    "Immediately run a scheduled playlist update",
    {
      schedule_id: z.string().describe("Schedule ID to run"),
    },
    async (args) => {
      try {
        const result = await handleRunNow(args, client, db, apiAvailability);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Startup schedule check
  const dueSchedules = findDueSchedules(db);
  for (const schedule of dueSchedules) {
    console.error(`[startup] Running due schedule: ${schedule.id}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
