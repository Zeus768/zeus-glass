# Zeus Glass - Product Requirements Document

## Original Problem Statement
Build a cross-platform mobile app for Android, Android TV, and Fire TV called "Zeus Glass" - an exact replica of Sky Glass UI with:
- TMDB/Trakt integration for metadata
- Real-Debrid/AllDebrid/Premiumize for torrent resolution
- IPTV (Xtreme Codes) with EPG and Live TV Guide
- Torrentio integration for torrent scraping
- Parental controls, Zeus Vault backup, internal player

## Tech Stack
- **Frontend**: React Native (Expo), Expo Router, TypeScript, Zustand
- **Backend**: Python FastAPI
- **Storage**: AsyncStorage (client-side), no database

## What's Been Implemented
### Core Features
- Home page with hero banner, trending movies/TV carousels
- 10-tab navigation: HOME, MOVIES, TV SHOWS, PROVIDERS, LIVE TV, TV GUIDE, CATCH UP, SEARCH, VOD, SETTINGS
- Movie/TV detail pages with debrid + direct streaming links
- Torrentio integration for finding torrents (direct + backend proxy)
- Real-Debrid device-code OAuth flow
- Trakt device-code auth with proxy fallback
- IPTV Xtreme Codes integration (Live channels, VOD, EPG)
- Internal player (Zeus Player) with subtitles support
- Zeus Vault backup/restore
- Parental controls with PIN
- Streaming providers page (Netflix, Disney+, Prime, HBO, etc.)

### Bug Fixes (March 13, 2026)
- FIXED: Invalid TMDB API key in providersService.ts (hardcoded key replaced with shared constant)
- FIXED: Search crash caused by missing STORAGE_KEYS (ALLDEBRID_API_KEY -> ALLDEBRID_TOKEN, PREMIUMIZE_API_KEY -> PREMIUMIZE_TOKEN)
- FIXED: Tab focus states enhanced with cyan background + white border + 1.15x scale for TV remote
- FIXED: Torrentio search no longer gated behind debrid token (shows results without login)
- FIXED: TV show torrent search also ungated from debrid token
- FIXED: Trakt auth with proxy fallback for environments with CORS issues
- FIXED: Player fullscreen now handles TV devices separately (no landscape lock on TV)
- FIXED: Added web fullscreen support (requestFullscreen/exitFullscreen)
- ADDED: Backend proxy endpoints for Torrentio (/api/torrentio/stream/) and Trakt (/api/trakt/device/code, /api/trakt/device/token)
- ADDED: with_watch_monetization_types=flatrate param for provider discovery API

## Prioritized Backlog

### P0 - Critical (Still needs user verification on actual TV device)
- Debrid links: Torrentio direct call works on native devices, proxy blocked by Cloudflare from cloud
- TV/Shield remote navigation: Focus states implemented, needs testing on actual Shield/Firestick
- Trakt login: Proxy added, needs testing on device

### P1 - High Priority
- Zeus Vault save/restore: Code looks functional, needs device testing
- Player fullscreen: TV-specific path added, needs device testing
- Infinite scroll on Providers page: Needs implementation (currently loads one page)

### P2 - Medium Priority
- UI elements "chopped" on TV screens: Needs device testing
- TV Guide EPG loading: Progress bar exists but needs verification
- Progress indicators for stream scraping: Implemented but needs verification
- Parental controls enable button: Code is correct, needs device testing

### P3 - Future Tasks
- More torrent scrapers (Torrserver, watchsomuch-tv.lol)
- Live TV tab completion (channel listing)
- IMDB/Trakt login improvements
- External Player (VLC) integration
- GitLab CI/CD setup

## IPTV Credentials (Testing)
- Domain: thenewdns.co
- Username: patrickteddyirl@gmail.com
- Password: 3cb7f892dc747bb4

## Key Architecture Notes
- All API calls from frontend use process.env.EXPO_PUBLIC_BACKEND_URL
- Backend routes prefixed with /api
- TMDB API key shared via constants (FALLBACK_TMDB_KEY)
- Torrentio: Direct call first, proxy fallback for web
- Trakt: Direct API first, proxy fallback for CORS
