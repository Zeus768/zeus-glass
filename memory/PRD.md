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
│   └── tests/             # pytest tests
└── frontend/
    ├── app/               # Expo Router pages
    │   ├── _layout.tsx    # Main tab layout, header (Exit/Donate), smaller tab sizes
    │   ├── index.tsx      # Home: hero + Next Up + Recently Played + carousels
    │   ├── settings.tsx   # Accounts, VPN, scrapers, content filter, vault
    │   ├── player.tsx     # Internal player with auto-hide controls (3s on TV)
    │   ├── movie/[id].tsx # Movie detail + stream selection
    │   ├── tv/[id].tsx    # TV show detail
    │   ├── live-tv.tsx    # IPTV channels (content-filtered)
    │   └── tv-guide.tsx   # EPG guide (null-safe, content-filtered)
    ├── components/
    │   ├── Carousel.tsx             # Watched badge support
    │   ├── NextUpCarousel.tsx       # Next Up episodes from Trakt
    │   ├── RecentlyPlayedCarousel.tsx  # Watch history with progress bars
    │   ├── DebridDownloadDialog.tsx
    │   ├── IPTVPipPlayer.tsx
    │   ├── SourcesSearchDialog.tsx
    │   └── FocusableCard.tsx
    ├── services/
    │   ├── contentFilterService.ts  # NSFW filter, link snooper
    │   ├── proxiedFetch.ts          # Centralized proxy routing
    │   ├── proxyService.ts          # Proxy settings & real testing
    │   ├── debrid.ts, tmdb.ts, trakt.ts, iptv.ts
    │   ├── streamScrapers.ts        # Uses proxiedFetch
    │   └── scraperStatusService.ts
    └── stores/
        └── useWatchedStore.ts       # Watched status + Next Up from Trakt
```

## Completed Features (All Sessions)

### TV Device Fixes (2026-03-21)
1. **Settings scroll past Real-Debrid** - Added `nestedScrollEnabled` + TV-specific ScrollView props
2. **Player controls auto-hide** - Reduced to 3s, resets on TV D-pad focus change
3. **Sizing after back from player** - `resetOrientation` skips on TV devices (always landscape)
4. **Exit App button** - Red "Exit" button in header on TV (BackHandler.exitApp)
5. **Live TV not populating** - Better error handling, content filter integration
6. **TV Guide crash fix** - Null-safe EPG parsing, useMemo for filtered channels
7. **VOD sizing on back** - Same fix as #3
8. **Menu tab sizing** - Further reduced tab padding/font/spacing by ~20%
9. **Content Filter** - Blocks adult content from streams/IPTV categories, link snooper

### New Features (2026-03-21)
- **Recently Played Carousel** - Shows watch history with progress bars, episode labels, time-ago
- **Content Filter Service** - NSFW keyword/domain blocking, category filtering, link snooping
- **Content Filter Settings UI** - Toggles for adult streams, adult IPTV categories, link snooper

### Previous Session Features
- Next Up Carousel, Watched Tick Marks, Donation Modal Fix
- VPN/Proxy Integration, Backend Proxy Endpoints
- Debrid Download Dialog, PiP, Scene Scrapers, Source Search
- TV UI Scaling, App Branding v1.5.0

## Pending Tasks
- P2: Performance optimization for Shield/Fire TV (FlashList, re-render profiling)
- P2: VPN speed test feature
- P3: Settings page scrolling fix (web-only issue)
- P3: IMDB Login integration
- P3: GitLab CI/CD setup

## Test Accounts
- Xtreme Codes: trex-iptv.com:8080
  - Username: trickteddyirl@gmail.com
  - Password: 3cb7f892dc747bb4
