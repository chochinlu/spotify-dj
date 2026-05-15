import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpotifyClient } from "../../src/spotify/client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("SpotifyClient", () => {
  let client: SpotifyClient;

  beforeEach(() => {
    client = new SpotifyClient(async () => "fake-token");
    mockFetch.mockReset();
  });

  it("getTopArtists returns artists with genres", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: "a1", name: "Artist", genres: ["pop", "rock"], images: [] },
        ],
      }),
    });
    const artists = await client.getTopArtists("medium_term");
    expect(artists[0].genres).toEqual(["pop", "rock"]);
  });

  it("handles 429 rate limit with retry", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => "1" },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });
    const artists = await client.getTopArtists("medium_term");
    expect(artists).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
