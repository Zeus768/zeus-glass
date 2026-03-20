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
    │   ├── _layout.tsx    # Main tab layout, header, donation modal
    │   ├── index.tsx      # Home page with hero + carousels
    │   ├── settings.tsx   # Accounts, VPN, scrapers, vault
    │   ├── search.tsx     # Universal search
    │   ├── movie/[id].tsx # Movie detail + stream selection
    │   ├── tv/[id].tsx    # TV show detail
    │   ├── live-tv.tsx    # IPTV channels
    │   └── tv-guide.tsx   # EPG guide
    ├── components/        # Reusable UI components
    ├── services/          # API integrations (debrid, tmdb, trakt, scrapers, proxy)
    ├── stores/            # Zustand stores (watched status)
    └── store/             # Auth & content stores
```

## What's Been Implemented

### Core Features (Complete)
- Sky Glass-style UI with dark theme and cyan accents
- TMDB integration for movie/TV metadata and images
- Hero banner with featured content
- Horizontal carousels for Trending, Popular, In Cinemas content
- Movie & TV show detail pages with stream source selection
- Universal search across TMDB
- Tab-based navigation (Home, Movies, TV Shows, Providers, Live TV, TV Guide, Catch Up, Search, VOD, Settings)

### Debrid Integration (Complete)
- Real-Debrid, AllDebrid, Premiumize authentication via QR code flow
- Debrid link resolution and unrestricting
- Cache search for instant playback
- Download progress dialog for non-cached torrents (DebridDownloadDialog)

### IPTV (Complete)
- Xtreme Codes login support
- Live TV channel listing with fullscreen drill-down
- EPG TV Guide
- Picture-in-Picture (PiP) mode for IPTV viewing while browsing

### Trakt Integration (Complete - Updated 2026-03-20)
- Device code authentication
- Watched status tracking via `useWatchedStore` Zustand store
- **Watched tick marks on carousel cards** (green checkmark badge)
- Watched data syncs from Trakt on app startup

### Stream Scrapers (Complete)
- Torrentio integration with configurable addons
- Knightcrawler and Comet Stremio addon scrapers
- DDLValley, RLSBB, ScnSrc scene release scrapers
- Source search dialog to search all scrapers simultaneously
- Scraper health status checker in Settings

### VPN/Proxy (Complete - Updated 2026-03-20)
- Proxy server selection UI with country flags
- **Backend proxy endpoint** (`/api/proxy/fetch`) for geo-unblocking
- **Backend proxy test endpoint** (`/api/proxy/test`) for connectivity testing
- **Integrated into streaming requests** (Torrentio, Knightcrawler, Comet scrapers use proxiedFetch)
- Real proxy connectivity testing through backend (replaces simulated tests)

### TV Optimization (In Progress)
- 30-50% size reduction for TV-optimized UI
- `React.memo` on FocusableCard for performance
- TV remote focus states with visible cyan highlights

### App Branding (Complete)
- Custom Zeus Glass icon and splash screen
- Version 1.5.0

### Bug Fixes (Updated 2026-03-20)
- **Fixed: Donation Modal appearing instead of auth modals** - Prevented Donate button from capturing TV focus with `focusable={false}` on TV devices
- Fixed: Stream link focus visibility on TV
- Fixed: Torrent badge labels (TORRENT vs DOWNLOAD)

### Settings Features (Complete)
- Account management (Trakt, Debrid services, IPTV)
- Torrentio configuration
- Streaming proxy/VPN settings with real proxy testing
- Scraper health status checker
- Zeus Vault backup/restore
- Donation modal
- Error logs viewer

## Known Limitations
- Public proxy servers in the built-in list are unreliable; users should add their own
- Torrentio may return 403 on some server IPs
- Web preview doesn't support TV-specific features (focus, PiP, file system)

## Pending Tasks
- P2: Performance optimization for Shield/Fire TV (FlashList, re-render profiling)
- P2: VPN speed test feature in proxy settings
- P3: Settings page scrolling fix (web-only issue)
- P3: IMDB Login integration
- P3: GitLab CI/CD setup

## Test Accounts
- Xtreme Codes: trex-iptv.com:8080
  - Username: trickteddyirl@gmail.com
  - Password: 3cb7f892dc747bb4
