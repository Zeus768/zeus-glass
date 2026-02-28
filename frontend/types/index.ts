// Media Types
export interface Movie {
  id: number;
  title: string;
  original_title?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genres?: Genre[];
  popularity: number;
  adult: boolean;
  video: boolean;
  original_language: string;
}

export interface TVShow {
  id: number;
  name: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genres?: Genre[];
  popularity: number;
  origin_country: string[];
  original_language: string;
}

export interface Genre {
  id: number;
  name: string;
}

export interface StreamLink {
  quality: string;
  url: string;
  source: 'real-debrid' | 'alldebrid' | 'premiumize' | 'iptv';
  size?: string;
  seeders?: number;
  isPremium?: boolean;
}

// Auth Types
export interface DebridAccount {
  username: string;
  email?: string;
  expiryDate: string;
  daysLeft: number;
  type: 'premium' | 'free';
  points?: number;
}

export interface IPTVConfig {
  domain: string;
  username: string;
  password: string;
  enabled: boolean;
}

export interface IPTVChannel {
  id: string;
  name: string;
  logo: string;
  category: string;
  epg?: EPGProgram[];
  stream_url: string;
}

export interface EPGProgram {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  channel_id: string;
  category?: string;
}

export interface VODItem {
  id: string;
  name: string;
  description: string;
  poster: string;
  backdrop?: string;
  category: string;
  stream_url: string;
  duration?: number;
  year?: string;
}

// Trakt Types
export interface TraktToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  created_at: number;
  scope: string;
}

export interface TraktUser {
  username: string;
  name: string;
  vip: boolean;
  vip_ep: boolean;
  ids: {
    slug: string;
  };
}

export interface ContinueWatching {
  media: Movie | TVShow;
  progress: number;
  lastWatched: string;
  type: 'movie' | 'tv';
}
