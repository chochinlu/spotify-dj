import { describe, it, expect, vi } from "vitest";
import { probeApiAvailability } from "../../src/spotify/api-probe";

describe("api-probe", () => {
  it("marks relatedArtists as unavailable on 403", async () => {
    const mockClient = {
      getRelatedArtists: vi
        .fn()
        .mockRejectedValue(new Error("403 Forbidden")),
      searchTracks: vi.fn().mockResolvedValue([]),
      getFeaturedPlaylists: vi.fn().mockResolvedValue([]),
      getNewReleases: vi.fn().mockResolvedValue([]),
    };
    const result = await probeApiAvailability(mockClient as any);
    expect(result.relatedArtists).toBe(false);
    expect(result.search).toBe(true);
  });
});
