# Zeus Glass - Product Requirements Document

## Original Problem Statement
Build a cross-platform mobile application for Android, Android TV, and Fire TV called "Zeus Glass" with a Sky Glass-inspired UI. Features include TMDB/Trakt integration, Debrid services, IPTV, free streaming, auto-updates, and TV-optimized navigation.

## Target Devices
- Android TV, Nvidia Shield, Fire TV (primary)
- Android mobile (secondary)
- Web preview (development only)

## Tech Stack
- **Frontend**: React Native (Expo), TypeScript, Zustand, FlashList, Expo Router
- **Backend**: FastAPI (Python), Playwright (headless scraping)
- **Storage**: AsyncStorage (local), Nextcloud (APK hosting)

## Core Features (All Implemented)
- Sky Glass-inspired dark UI with hero carousels
- TMDB/Trakt metadata integration
- Real-Debrid/AllDebrid/Premiumize debrid services
- Torrentio addon scraping
- IPTV with Xtreme Codes login, EPG guide, VOD
- Mobiflix-style free streaming (ad-free via Playwright headless extraction)
- Internal/External player choice with subtitle support
- Unified search across all content sources
- Nextcloud-based APK auto-updater with Changelog overlay
- Trakt watched status, Next Up, Recommendations
- Content filtering for adult categories
- Ko-fi donation link
- TV-optimized focus states with gold borders

## UI Enhancements (v2.5.0 - March 2026)
- Netflix-style progress bars on all carousel cards
- Ambient background glow on movie & TV detail pages
- Quick Resume banner on detail pages (resume from last position)
- Watch history progress data across home screen carousels

## Completed Work Summary
1. Sky Glass UI with hero/category carousels
2. TMDB + Trakt full integration
3. Debrid service integration (RD/AD/PM)
4. IPTV with EPG and VOD
5. Free streaming with headless extraction
6. APK auto-updater + Changelog overlay
7. FlashList performance refactoring (9 screens)
8. TV focus state fixes (gold highlights, scroll preservation)
9. Shield crash fix (removed BlurView)
10. Sources dialog height fix
11. Progress bars on carousel cards
12. Ambient backgrounds on detail pages
13. Quick Resume functionality
14. Version bumped to 2.5.0

## Pending / Future Tasks
- P1: GitLab CI/CD setup
- P3: Watch Party (synchronized remote viewing)
- P3: IMDB Login integration
- Ongoing: TV focus/navigation regression monitoring

## Key API Endpoints
- `/api/extract/video` - Standard HTTP video extraction
- `/api/extract/headless` - Playwright-powered extraction
- `/api/extract/best` - Auto-select best free stream
- `/api/torrentio/stream/:type/:imdbId.json` - Torrentio proxy
- `/api/proxy/fetch` - Proxied fetch for geo-blocked content

## Architecture
```
/app
├── backend/
│   ├── server.py
│   ├── torrent_scraper.py
│   ├── video_extractor.py
│   └── headless_extractor.py
└── frontend/
    ├── version.json (v2.5.0)
    ├── app/
    │   ├── _layout.tsx
    │   ├── index.tsx (home - carousels with progress)
    │   ├── movie/[id].tsx (ambient bg + quick resume)
    │   ├── tv/[id].tsx (ambient bg + quick resume)
    │   ├── settings.tsx
    │   ├── live-tv.tsx
    │   └── tv-guide.tsx
    ├── components/
    │   ├── Carousel.tsx (progress bars)
    │   ├── ContinueWatchingCarousel.tsx
    │   └── ChangelogOverlay.tsx
    ├── services/
    │   ├── watchHistoryService.ts
    │   ├── freeStreamService.ts
    │   ├── updateService.ts
    │   └── focusSoundService.ts
    └── stores/
        └── useWatchedStore.ts
```
