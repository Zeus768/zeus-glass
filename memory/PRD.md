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

### Previous Session Features
- Next Up Carousel, Watched Tick Marks
- VPN/Proxy Integration, Backend Proxy Endpoints
- Debrid Download Dialog, PiP, Scene Scrapers, Source Search
- TV UI Scaling, App Branding v1.5.0

## Pending Tasks
- P3: Settings page scrolling fix (web-only)
- P3: IMDB Login integration
- P3: GitLab CI/CD setup

## Test Accounts
- Xtreme Codes: trex-iptv.com:8080
  - Username: trickteddyirl@gmail.com
  - Password: 3cb7f892dc747bb4
