export type Track = {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration_ms: number;
  preview_url: string | null;
};

export type PlaylistRecord = {
  id: string;
  spotify_id: string;
  name: string;
  description: string | null;
  auto_update: boolean;
  created_at: string;
  updated_at: string;
};

export type TrackRecord = {
  id: string;
  name: string;
  artist: string;
  album: string | null;
  duration_ms: number | null;
  genre_tags: string | null; // JSON array
  language: string | null;
  added_at: string;
};

export type RecommendationRecord = {
  id: string;
  track_id: string;
  strategy: "similar" | "curated" | "surprise";
  status: "pending" | "accepted" | "rejected";
  playlist_id: string | null;
  created_at: string;
};

export type PreferenceRecord = {
  id: string;
  rule: string;
  parsed_rule: string; // JSON
  active: boolean;
  created_at: string;
};

export type ScheduleRecord = {
  id: string;
  playlist_id: string;
  cron: string;
  strategy: "similar" | "curated" | "surprise" | "auto";
  enabled: boolean;
  last_run: string | null;
  created_at: string;
};

export type ApiAvailability = {
  relatedArtists: boolean;
  search: boolean;
  featuredPlaylists: boolean;
  newReleases: boolean;
};
