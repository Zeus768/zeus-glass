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
- 10-tab navigation with cyan focus states for TV remote
- Movie/TV detail pages with debrid + direct streaming links
- Torrentio integration (direct + backend proxy fallback)
- Real-Debrid device-code OAuth flow
- Trakt device-code auth with proxy fallback
- IPTV Xtreme Codes integration (Live channels, VOD, EPG)
- Internal player (Zeus Player) with Modal fullscreen overlay
- Zeus Vault backup/restore
- Parental controls with PIN
- Streaming providers page (Netflix, Disney+, Prime, HBO, etc.)

### Session 3 Changes (March 20, 2026)
- **TV UI Size Reduction (~50% reduction for TV)**:
  - Reduced global theme font sizes for TV by ~40-50%
  - Reduced card sizes in theme (cardWidth: 160, cardHeight: 240)
  - Reduced tab bar padding, font sizes, and spacing
  - Reduced header "ZEUS GLASS" and donate button sizes
  - Reduced donation modal sizes (QR code, fonts, padding)
  - Reduced QR auth modal sizes (modal width, QR code 160px, fonts)
  - Reduced settings page card padding and font sizes
  - Reduced account card button sizes and icon sizes
- **Zeus Vault Improvements**:
  - Updated to use `expo-file-system/legacy` API for SDK 54 compatibility
  - Improved error handling with fallbacks for TV devices
  - Renamed buttons for clarity: "Save Backup", "Restore Backup", "Share/Copy", "Paste Import"
  - Added user feedback with success/error alerts
  - Added clipboard fallback when Share is not available (for TV devices)
- **Parental Controls**: Verified working - Enable button opens PIN setup modal correctly
- **Added data-testid attributes** to Zeus Vault and Parental Controls buttons for testing
- **Picture-in-Picture (PiP) for IPTV**:
  - New `IPTVPipPlayer` component for mini-player overlay
  - Added expo-pip library for native Android PiP support
  - Integrated PiP into TV Guide page (click PiP button to watch while browsing)
  - Integrated PiP into Live TV page (long-press to start PiP mode)
  - Mini player shows in bottom-right corner with play/pause, close, fullscreen controls
- **Torrent Source Search Dialog**:
  - New `SourcesSearchDialog` component for searching all scrapers
  - Shows real-time search progress for each scraper
  - Added `getAllSourcesWithProgress` method to streamScrapers service
  - Tabs to filter by source type (All, Torrent, Embed, Direct)
- **Scene Release Site Scrapers**:
  - Added DDLValley, Scene Source (scnsrc), RLSBB scraper definitions
  - Extended `StreamSource` interface with releaseGroup and releaseType fields

### Session 2 Changes (March 15, 2026)
- **PlayerChoice dialog**: Universal player selector on ALL play actions (Internal, VLC, MX Player, Just Player, System Default) - integrated in movies, TV shows, IPTV Live TV, VOD, TV Guide
- **IPTV categories fixed**: Channels now include `category_id` for proper categorization. Categories show correct channel counts.
- **Live TV page rewritten**: Fullscreen category drill-down - tap a category to see full-grid channels, back button to return. Long-press for quick VLC launch.
- **Player fullscreen via Modal**: Player wrapped in `<Modal>` for true native fullscreen on Android TV/Fire TV
- **Trakt watch tracking**: Added `getWatchedMovies/Shows`, `markAsWatched`, `getShowProgress` methods
- **Next Up episode**: TV show detail shows next unwatched episode with progress bar when Trakt connected
- **Watched tick marks**: FocusableCard supports `isWatched` prop with green tick badge
- **Show status badges**: "ENDED" (red) and "Airing" (green) badges on TV show cards and detail pages
- **TV Guide categories fixed**: Updated to use `category_id`/`category_name` format
- **VOD categories fixed**: Updated to use consistent `IPTVCategory` type
- **Trakt crash fixed**: All Trakt methods wrapped in try-catch, scrobble signatures corrected
- **playerState event system**: Global state manager for player fullscreen (hides header/tabs on native)

### Session 1 Changes (March 13, 2026)
- Fixed invalid TMDB API key in providersService.ts
- Fixed search crash (missing STORAGE_KEYS)
- Enhanced tab focus states for TV remote
- Torrentio search works without debrid token
- Backend proxy endpoints for Torrentio and Trakt
- Player TV-specific fullscreen path
- Added `with_watch_monetization_types=flatrate` for provider discovery

## Prioritized Backlog

### P0 - User Verification Needed
- IPTV categories with channel counts (code done, needs Shield TV testing)
- PlayerChoice dialog on all play actions (code done, needs device testing)
- Player fullscreen via Modal (works on native, not web)
- Trakt auth flow (proxy fallback added)
- Zeus Vault Save/Restore functionality (improved, needs native testing)
- Parental Controls PIN setup (verified working in web preview)

### P1 - Remaining Work
- Picture-in-Picture (PiP) mode for player (browse while watching in corner)
- Watched tick marks integration into home/browse pages (FocusableCard supports it, need to wire up Trakt data)
- Shield TV performance optimization (lazy loading, reduce re-renders)
- Infinite scroll on Providers page
- Enhanced D-pad navigation focus across all screens

### P2 - Future
- More torrent scrapers (Torrserver, watchsomuch)
- GitLab CI/CD setup
- IMDB Login integration (needs clarification)

## Key Architecture
- All API calls use `process.env.EXPO_PUBLIC_BACKEND_URL`
- Backend routes prefixed with `/api`
- TMDB key via constants (`FALLBACK_TMDB_KEY`)
- Torrentio: Direct first, proxy fallback
- Trakt: Direct first, proxy fallback
- IPTV categories use `IPTVCategory` type with `category_id`/`category_name`
- PlayerChoice component is the universal player selector
- Player uses `<Modal>` for native fullscreen
- Zeus Vault uses `expo-file-system/legacy` for SDK 54 compatibility

## IPTV Credentials (Testing)
- Domain: thenewdns.co
- Username: patrickteddyirl@gmail.com
- Password: 3cb7f892dc747bb4
