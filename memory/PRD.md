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


### Performance Refactoring: FlashList Migration (2026-03-27)
- Replaced FlatList/ScrollView with `@shopify/flash-list` across all performance-critical screens
- **Grid screens converted**: `movies.tsx`, `tv-shows.tsx`, `vod.tsx`, `franchises.tsx` (2 lists), `live-tv.tsx` (2 lists)
- **Search results**: Converted from ScrollView with pre-rendered `.map()` to FlashList with proper `renderItem` pattern
- **Home carousels**: `Carousel.tsx` horizontal ScrollView replaced with horizontal FlashList for recycled rendering
- **Bug fixes**: Fixed `await` inside non-async `useEffect` in `search.tsx`; moved `logger` initialization before first usage in `server.py`
- Significantly reduces memory footprint and improves scroll performance on Fire TV/Shield/older Firesticks

### Free Streams Feature — Mobiflix-style (2026-03-27)
- Created `freeStreamService.ts` — ranks 15 free embed servers by reliability (VidSrc → VidSrc Pro → Videasy → SuperEmbed → etc.)
- **Movie detail page**: Added green "Watch Free" button between Play and All Sources. Opens a modal showing all free servers with a "BEST" badge on top pick. Tap any server to play instantly.
- **TV show detail page**: Added green "Free" button on each episode card. Opens same modal with episode label (e.g., S1E1). Tap any server to play the episode instantly.
- No Debrid required — these are free embed sources that work like Mobiflix servers

### Critical Bug Fix: Sources Dialog Links Not Visible (2026-03-27)
- **Problem**: SourcesSearchDialog showed header, source badges, and tabs, but the actual clickable stream links were invisible (FlatList had 0 height because dialog used content-determined maxHeight)
- **Fix**: Converted dialog from centered modal to bottom sheet with fixed `SCREEN_HEIGHT * 0.80` height. FlatList now fills remaining space after header/tabs.
- **Result**: All 15 sources' links are now visible and tappable

### Player Ad-Blocking for Free Streams (2026-03-27)
- Added `onShouldStartLoadWithRequest` URL filter blocking 30+ ad/popup domains
- Added `injectedJavaScript` that injects CSS to hide ad elements, blocks `window.open()` popups, periodically removes injected ad DOM elements
- Embeds now play much cleaner on native Android — similar to Mobiflix's approach
- Backend video URL extractor created (`video_extractor.py`) for future direct m3u8/mp4 extraction (requires JS-capable scraping for most sources)


### 6 Bug Fixes (2026-03-27)
1. **TV Guide crash fixed** - Added `safeFormat()` helper with `isValid()` date checking. Try-catch around FlashList renderItem prevents individual channel errors from crashing the list.
2. **IPTV not populating fixed** - Changed `isLoggedIn()` from sync to async - now actually checks config state instead of relying on uninitialized `_isLoggedIn` property.
3. **Player controls fixed** - Removed persistent back/cast buttons. ALL controls (back, cast, play/pause, seek) now only appear when user taps screen, auto-hide after inactivity.
4. **Movie links can't play fixed** - Added 350ms delay between closing links modal and opening PlayerChoice dialog to prevent Android modal overlap issues.
5. **Menu tabs stuck fixed** - Added playerState failsafe in `_layout.tsx`: if user navigates away from player but playerState still active, force resets tabs. Also improved `useFocusEffect` cleanup.
6. **Android 11+ & Fire Stick support** - Set `minSdkVersion: 21` for older devices, added `ACCESS_NETWORK_STATE` permission, leanback features already present.

### Auto-Update from Nextcloud (2026-03-27)
- Created `updateService.ts` - checks Nextcloud WebDAV (`https://nextcloud.rs-s.co.uk/public.php/webdav/`) for `version.json`, compares with app version, downloads APK, triggers Android package installer
- Created `UpdateDialog.tsx` - modal with changelog, download progress bar, retry on failure
- Integrated auto-check on app startup in `_layout.tsx` (Android only)
- Added "Check for Updates" button in Settings > About section
- Added `REQUEST_INSTALL_PACKAGES` permission to AndroidManifest.xml and app.json
- Template `version.json` created at `/app/frontend/version.json` - user uploads this + APK to Nextcloud share
- Installed `expo-intent-launcher` for triggering APK install intent

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
- P1: GitLab CI/CD setup
- P3: IMDB Login integration
- P3: Watch Party feature

## Known Limitations
- Torrentio/Stremio addon APIs are blocked by Cloudflare from datacenter IPs (preview environment). Works on real Android devices with residential IPs.
- Casting service (castService.ts) is MOCKED - packages not installed/configured
- VLC no-video fix needs user verification on real Android device
- Web preview has ScrollView limitations (can't scroll to see below-fold content)

## Test Accounts
- Xtreme Codes: trex-iptv.com:8080
  - Username: trickteddyirl@gmail.com
  - Password: 3cb7f892dc747bb4
