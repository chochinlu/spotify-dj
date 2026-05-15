const BASE_URL = "https://api.spotify.com/v1";

export type TokenProvider = () => Promise<string>;

export class SpotifyClient {
  constructor(private getToken: TokenProvider) {}

  private async request<T>(
    path: string,
    options?: RequestInit,
    retries = 3,
  ): Promise<T> {
    const accessToken = await this.getToken();
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...options?.headers,
        },
      });
    } catch (err) {
      throw new Error(
        `Spotify API network error: ${(err as Error).message}`,
      );
    }
    if (res.status === 429 && retries > 0) {
      const retryAfter = parseInt(
        res.headers.get("Retry-After") || "1",
        10,
      );
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.request(path, options, retries - 1);
    }
    if (!res.ok) {
      throw new Error(
        `Spotify API error: ${res.status} ${res.statusText}`,
      );
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async getTopArtists(
    timeRange: string,
    limit = 50,
  ): Promise<SpotifyArtist[]> {
    const data = await this.request<{ items: SpotifyArtist[] }>(
      `/me/top/artists?time_range=${timeRange}&limit=${limit}`,
    );
    return data.items;
  }

  async getTopTracks(
    timeRange: string,
    limit = 50,
  ): Promise<SpotifyTrack[]> {
    const data = await this.request<{ items: SpotifyTrack[] }>(
      `/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
    );
    return data.items;
  }

  async getRecentlyPlayed(limit = 50): Promise<SpotifyTrack[]> {
    const data = await this.request<{
      items: { track: SpotifyTrack }[];
    }>(`/me/player/recently-played?limit=${limit}`);
    return data.items.map((i) => i.track);
  }

  async getRelatedArtists(artistId: string): Promise<SpotifyArtist[]> {
    const data = await this.request<{ artists: SpotifyArtist[] }>(
      `/artists/${artistId}/related-artists`,
    );
    return data.artists;
  }

  async getArtistTopTracks(artistId: string): Promise<SpotifyTrack[]> {
    const data = await this.request<{ tracks: SpotifyTrack[] }>(
      `/artists/${artistId}/top-tracks?market=US`,
    );
    return data.tracks;
  }

  async searchTracks(
    query: string,
    limit = 20,
  ): Promise<SpotifyTrack[]> {
    const data = await this.request<{
      tracks: { items: SpotifyTrack[] };
    }>(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    );
    return data.tracks.items;
  }

  async createPlaylist(
    userId: string,
    name: string,
    description: string,
    isPublic: boolean,
  ): Promise<string> {
    const data = await this.request<{ id: string }>(
      `/users/${userId}/playlists`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, public: isPublic }),
      },
    );
    return data.id;
  }

  async addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
  ): Promise<void> {
    await this.request(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris: trackUris }),
    });
  }

  async removeTracksFromPlaylist(
    playlistId: string,
    trackUris: string[],
  ): Promise<void> {
    await this.request(`/playlists/${playlistId}/tracks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracks: trackUris.map((uri) => ({ uri })),
      }),
    });
  }

  async unfollowPlaylist(playlistId: string): Promise<void> {
    await this.request(`/playlists/${playlistId}/followers`, {
      method: "DELETE",
    });
  }

  async getFeaturedPlaylists(): Promise<SpotifyPlaylist[]> {
    const data = await this.request<{
      playlists: { items: SpotifyPlaylist[] };
    }>("/browse/featured-playlists");
    return data.playlists.items;
  }

  async getNewReleases(): Promise<SpotifyAlbum[]> {
    const data = await this.request<{
      albums: { items: SpotifyAlbum[] };
    }>("/browse/new-releases");
    return data.albums.items;
  }

  async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    const data = await this.request<{
      items: { track: SpotifyTrack }[];
    }>(`/playlists/${playlistId}/tracks`);
    return data.items.map((i) => i.track);
  }

  async getCurrentUser(): Promise<{ id: string; display_name: string }> {
    return this.request<{ id: string; display_name: string }>("/me");
  }
}

export type SpotifyArtist = {
  id: string;
  name: string;
  genres: string[];
  images: { url: string }[];
};

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
  duration_ms: number;
  preview_url: string | null;
  uri: string;
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  description: string;
};

export type SpotifyAlbum = {
  id: string;
  name: string;
  artists: { name: string }[];
};
