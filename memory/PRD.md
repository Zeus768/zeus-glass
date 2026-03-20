# Zeus Glass - Product Requirements Document

## Overview
Zeus Glass is a cross-platform mobile streaming application for Android, Android TV, and Fire TV. It replicates the "Sky Glass" UI aesthetic and integrates with multiple streaming services, debrid providers, IPTV, and content tracking via Trakt.

## Tech Stack
- **Frontend**: React Native, Expo, Expo Router, TypeScript, Zustand
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (via MONGO_URL)
- **Key Libraries**: expo-pip, expo-image, expo-linear-gradient, react-native-video, axios

## Architecture
```
/app
├── backend/
│   ├── server.py          # FastAPI with proxy, debrid, torrentio, trakt endpoints
│   └── tests/             # pytest tests for proxy endpoints
└── frontend/
    ├── app/               # Expo Router pages
    │   ├── _layout.tsx    # Main tab layout, header, donation modal, watched store init
    │   ├── index.tsx      # Home page with hero + Next Up + carousels
    │   ├── settings.tsx   # Accounts, VPN, scrapers, vault
    │   ├── search.tsx     # Universal search
    │   ├── movie/[id].tsx # Movie detail + stream selection
    │   ├── tv/[id].tsx    # TV show detail
    │   ├── live-tv.tsx    # IPTV channels
    │   └── tv-guide.tsx   # EPG guide
    ├── components/
    │   ├── Carousel.tsx         # Horizontal carousel with watched badge support
    │   ├── NextUpCarousel.tsx   # Next Up episode cards from Trakt
    │   ├── DebridDownloadDialog.tsx
    │   ├── IPTVPipPlayer.tsx
    │   ├── SourcesSearchDialog.tsx
    │   └── FocusableCard.tsx
    ├── services/
    │   ├── debrid.ts
    │   ├── tmdb.ts              # Added getEpisodeDetails, getTVShowBasic
    │   ├── trakt.ts             # Added getWatchedShowsWithIds
    │   ├── streamScrapers.ts    # Uses proxiedFetch
    │   ├── proxiedFetch.ts      # Centralized proxy routing
    │   ├── proxyService.ts      # Proxy settings & real backend testing
    │   └── scraperStatusService.ts
    └── stores/
        └── useWatchedStore.ts   # Watched status + Next Up from Trakt
```

## What's Been Implemented

### Core Features (Complete)
- Sky Glass-style UI with dark theme and cyan accents
- TMDB integration for movie/TV metadata and images
- Hero banner with featured content
- Horizontal carousels for Trending, Popular, In Cinemas content
- Movie & TV show detail pages with stream source selection
- Universal search across TMDB
- Tab-based navigation

### Next Up Enhancement (Complete - 2026-03-20)
- **"Next Up" horizontal carousel** on home page showing next unwatched episode for each show the user is watching
- Episode still/backdrop images from TMDB, green S01E05 badge, show title, episode title
- Green play button focus state, tapping navigates to the TV show detail page
- Data from Trakt `getShowProgress` + TMDB episode details
- Cached in AsyncStorage for offline access
- Gracefully hidden when Trakt is not connected

### Watched Tick Marks (Complete - 2026-03-20)
- Green checkmark badges on carousel cards for watched content
- `useWatchedStore` Zustand store syncs from Trakt on app startup
- Passed to all home page carousels via `watchedIds` prop

### Donation Modal Bug Fix (Complete - 2026-03-20)
- Fixed: Donate button no longer captures TV remote focus from settings
- `focusable={false}` on TV devices prevents accidental triggering

### VPN/Proxy Integration (Complete - 2026-03-20)
- Backend `/api/proxy/fetch` and `/api/proxy/test` endpoints
- `proxiedFetch.ts` utility for routing streaming requests through proxy
- Integrated into Torrentio, Knightcrawler, Comet scrapers
- Real proxy connectivity testing replaces simulated tests

### Debrid Integration (Complete)
- Real-Debrid, AllDebrid, Premiumize authentication via QR code
- Debrid link resolution, cache search, download progress dialog

### IPTV (Complete)
- Xtreme Codes login, Live TV, EPG TV Guide, Picture-in-Picture

### Stream Scrapers (Complete)
- Torrentio, Knightcrawler, Comet, DDLValley, RLSBB, ScnSrc
- Source search dialog, scraper health checker

### App Branding (Complete)
- Custom icon, splash screen, version 1.5.0

## Pending Tasks
- P2: Performance optimization for Shield/Fire TV
- P2: VPN speed test feature
- P3: Settings page scrolling fix (web-only)
- P3: IMDB Login integration
- P3: GitLab CI/CD setup

## Test Accounts
- Xtreme Codes: trex-iptv.com:8080
  - Username: trickteddyirl@gmail.com
  - Password: 3cb7f892dc747bb4
