# Zeus Glass - Product Requirements Document

## Overview
Zeus Glass is a cross-platform mobile streaming application for Android, Android TV, and Fire TV. It replicates the "Sky Glass" UI aesthetic and integrates with multiple streaming services, debrid providers, IPTV, and content tracking via Trakt.

## Tech Stack
- **Frontend**: React Native, Expo, Expo Router, TypeScript, Zustand
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (via MONGO_URL)
- **Key Libraries**: expo-pip, expo-image, expo-linear-gradient, react-native-video, axios, date-fns

## Architecture
```
/app
├── backend/
│   ├── server.py          # FastAPI with proxy, debrid, torrentio, trakt endpoints
│   └── tests/
└── frontend/
    ├── app/               # Expo Router pages
    │   ├── _layout.tsx    # Tab layout, header (Exit/Donate), smaller tabs
    │   ├── index.tsx      # Home: hero + Next Up + Recently Played + Recommendations + carousels
    │   ├── settings.tsx   # Accounts, VPN + Speed Test, Content Filter, Scraper Status, Vault
    │   ├── player.tsx     # Internal player: persistent back btn, 3s auto-hide, VLC intent fix
    │   ├── movie/[id].tsx
    │   ├── tv/[id].tsx
    │   ├── live-tv.tsx    # Content-filtered IPTV
    │   └── tv-guide.tsx   # Null-safe EPG, content-filtered
    ├── components/
    │   ├── Carousel.tsx             # Watched badge support
    │   ├── NextUpCarousel.tsx       # Next unwatched episodes
    │   ├── RecentlyPlayedCarousel.tsx  # Watch history + progress bars
    │   ├── DebridDownloadDialog.tsx
    │   ├── IPTVPipPlayer.tsx
    │   ├── SourcesSearchDialog.tsx
    │   └── FocusableCard.tsx
    ├── services/
    │   ├── contentFilterService.ts  # NSFW filter + link snooper
    │   ├── proxiedFetch.ts
    │   ├── proxyService.ts
    │   ├── debrid.ts, tmdb.ts, trakt.ts, iptv.ts
    │   ├── streamScrapers.ts
    │   └── scraperStatusService.ts
    └── stores/
        └── useWatchedStore.ts   # Watched + Next Up + Recommendations
```

## Completed Features

### Trakt Recommendations (2026-03-21)
- Personalized movie and TV show recommendations from Trakt
- `getRecommendedMovies()` and `getRecommendedShows()` API methods
- Resolved to full TMDB objects via `getMoviesByIds()` / `getTVShowsByIds()`
- Displayed in sparkles-icon carousels on home page
- Hidden gracefully when Trakt not connected

### Player Fixes (2026-03-21)
- **Persistent back button** - Always visible on player (not just in controls overlay)
- **VLC fix** - Changed from `vlc://` to `intent://...#Intent;package=org.videolan.vlc;type=video/*;end` for proper video (not audio-only) playback
- **Controls auto-hide** - 3 seconds on TV, resets timer on D-pad focus change
- **Orientation fix** - `resetOrientation` skips on TV (always landscape)

### VPN Speed Test (2026-03-21)
- Speed test button in VPN/Proxy settings section
- Calls `/api/proxy/test` with current proxy config
- Shows latency, IP, and quality assessment in alert

### Content Filter (2026-03-21)
- Blocks adult content from stream links and IPTV categories
- Keyword/domain-based filtering with customizable blocklist
- Link Snooper follows redirects to find clean URLs
- Toggles in Settings: Block Adult Streams, Block Adult Categories
- Integrated into live-tv and tv-guide

### Recently Played (2026-03-21)
- Carousel on home page from watch history
- Shows progress bars, episode labels, time-ago text
- Orange-themed cards with backdrop images

### TV Device Fixes (2026-03-21)
- Settings scroll past Real-Debrid (nestedScrollEnabled)
- Exit App button on TV (BackHandler.exitApp)
- Menu tab sizing reduced ~20%
- TV Guide crash fix (null-safe EPG)
- Donation modal fix (focusable={false} on TV)

### Bug Fixes (2026-03-24)
- **Settings crash fix** - Added missing `Platform` import from react-native in settings.tsx (was causing ReferenceError crash)
- **Stream source fallbacks** - Backend proxy now tries Torrentio -> Knightcrawler -> MediaFusion as fallback Stremio addons
- **Frontend addon resilience** - Frontend `searchTorrentio` now tries multiple addon endpoints before falling back to backend proxy

### Franchises Expansion (2026-03-24)
- Expanded from 20 to 80+ unique franchise collections (Spider-Man, Avengers, Star Wars, Harry Potter, etc.)
- Infinite scroll pagination (loads 30 at a time via FlatList onEndReached)
- Franchise detail view shows movies sorted by release date
- Deduplication logic to prevent repeated collections

### Providers Redesign (2026-03-24)
- Complete redesign with provider logo grid: Netflix, Disney+, Hulu, HBO Max, Apple TV+, Paramount+, Peacock, Starz, Crunchyroll, MUBI, Curiosity Stream, BritBox, Tubi, Pluto TV, Freevee, Plex
- Per-provider content browsing with unlimited scroll (FlashList onEndReached)
- Provider brand colors and badges on content cards
- Sort options: Popular, Top Rated, Newest
- Movies/TV Shows toggle for each provider
- Fixed HBO Max provider ID (384 -> 1899) and updated Starz logo
- Removed deprecated/unavailable providers (Showtime, Stan, Now TV, Sky Go)

### Home Screen TV Zoom Fix (2026-03-24)
- Reduced TV hero height from 75% to 42% of screen
- Reduced all TV element sizes by 40-50% (fonts, padding, buttons, spacing)
- Theme card sizes reduced: width 160->130, height 240->195
- Now fits Shield/Fire TV screens properly with scrollable content below hero

### Previous Session Features
- Next Up Carousel, Watched Tick Marks
- VPN/Proxy Integration, Backend Proxy Endpoints
- Debrid Download Dialog, PiP, Scene Scrapers, Source Search
- TV UI Scaling, App Branding v1.5.0

## Pending Tasks
- P2: TV performance optimization (replace ScrollView with @shopify/flash-list in remaining areas)
- P3: Settings page scrolling fix (web-only)
- P3: IMDB Login integration
- P1: GitLab CI/CD setup

## Known Limitations
- Torrentio/Stremio addon APIs are blocked by Cloudflare from datacenter IPs (preview environment). Works on real Android devices with residential IPs.
- Cast button rendering issue on web (deprioritized per user request)
- Casting service (castService.ts) is MOCKED - packages not installed/configured
- VLC no-video fix needs user verification on real Android device

## Test Accounts
- Xtreme Codes: trex-iptv.com:8080
  - Username: trickteddyirl@gmail.com
  - Password: 3cb7f892dc747bb4
