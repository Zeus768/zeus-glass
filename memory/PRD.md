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
- P2: FlashList performance optimization for TV carousels
- P2: Link Snooper for free scraper adult content filtering (backend + frontend)
- P2: Settings page refactoring (>2600 lines -> sub-components)
- P3: IMDB Login integration
- P3: GitLab CI/CD setup

### TV Navigation Exit Crash Fix (2026-04-18)
- **Root cause**: On Android TV (Mecool, Firestick), D-pad navigation past the last visible element in Settings ScrollView triggered a system "back" event, which Expo Router interpreted as back navigation from a root tab → app exit
- **Fix 1**: Global BackHandler in `_layout.tsx` consumes back press on TV devices (returns true). App can ONLY be exited via the Exit button.
- **Fix 2**: Exit button now shows confirmation dialog ("Are you sure?") instead of instant `BackHandler.exitApp()`
- **Fix 3**: Settings page has its own BackHandler via `useFocusEffect` as additional safety

### Cloud Log Upload System (2026-04-17)
- **Backend**: `POST /api/logs/upload` stores device logs in MongoDB, `GET /api/logs` retrieves them, `GET /api/logs/dashboard` web viewer, `DELETE /api/logs/clear`
- **Frontend**: "Upload to Cloud" button in Settings > Debug & Support section - works on ALL devices including Fire TV
- **Auto-upload on startup**: Silently uploads error logs to cloud every time the app starts (throttled to once per 5 minutes). No user action required on Fire TV.
- **Dashboard**: Web-based log viewer at `/api/logs/dashboard` with stats, filters, search, export JSON
- Keeps existing email/Telegram buttons for mobile devices
- Each device gets a persistent unique ID for tracking

## Bug Fixes (2026-04-17)

### TV D-pad Navigation Fix (P0) - FIXED
- Root cause: Sections below Zeus Vault (VPN, Scrapers, Content Filter, Parental, Player Settings, Debug) did NOT call `scrollToFocused` when focused via D-pad. Also no `onLayout` tracking on their containers.
- Fix: Modified `AccountSection` component to accept `sectionKey` and auto-track Y-position via `onLayout`. Changed ALL `onFocus` handlers from `setFocusedElement()` to `handleTVFocus(elementKey, sectionKey)` which both sets state AND programmatically scrolls the ScrollView. 17 focusable elements now properly trigger scroll.
- Also added missing `Platform` import from react-native.

### Player urlLower Build Error Fix (P1) - FIXED
- Root cause: User's local ad-blocking code declares `const urlLower`, which collides with inline `url?.toLowerCase()` usage.
- Fix: Declared `const urlLower = url?.toLowerCase() || ''` once at component level (line ~75), referenced in useEffect. User's code can now use `urlLower` without redeclaring.

## Test Accounts
- Xtreme Codes: trex-iptv.com:8080
  - Username: trickteddyirl@gmail.com
  - Password: 3cb7f892dc747bb4
