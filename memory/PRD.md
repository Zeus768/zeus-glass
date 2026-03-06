# Zeus Glass - Product Requirements Document

## Project Overview
Zeus Glass is a cross-platform streaming application for Android, Android TV, and Fire TV that replicates the "Sky Glass" aesthetic with a premium, glassmorphic dark theme.

## Original Problem Statement
Build a cross-platform mobile application called "Zeus Glass" with:
- Sky Glass-inspired UI/UX with glassmorphic dark theme
- TV-compatible layout with remote control focus management
- Integration with TMDB and Trakt for metadata
- Torrent scraping with Real-Debrid integration
- IPTV support with Xtreme Codes credentials
- Parental controls, recording functionality, and error logging

## Core Requirements

### UI/UX
- [x] Full-screen TV layout with focus indicators for remote navigation
- [x] Scrollable top navigation tabs (HOME, MOVIES, TV SHOWS, LIVE TV, CATCH UP, SEARCH, VOD, SETTINGS)
- [x] Hero carousel on home screen with trending content
- [x] Horizontal scrolling carousels for content categories
- [x] Infinite scrolling with FlatList in Movies/TV Shows grids
- [x] TV-scaled font sizes and touch targets
- [x] Mobile-responsive layouts (2-3 column grids on phones)
- [x] QR code authentication modals with readable sizing

### Content Integration
- [x] TMDB integration for movie/TV show metadata
- [x] Real-Debrid cached torrent search from multiple indexers
- [x] Uncached torrent support
- [x] Multiple indexers: Torrentio, Mediafusion, Knightcrawler, Comet, Jackettio

### IPTV Features
- [x] Xtreme Codes IPTV login
- [x] Live TV guide with EPG
- [x] VOD content tab
- [x] Recording/scheduling functionality
- [x] Catch Up tab for recordings

### Account Management
- [x] Trakt authentication
- [x] Real-Debrid authentication
- [x] AllDebrid authentication
- [x] Premiumize authentication
- [x] IPTV credentials storage

### Additional Features
- [x] Parental controls with PIN
- [x] Error logging with email/Telegram export
- [x] Donation button linking to buymeacoffee.com/zeus768

## Technical Stack
- **Frontend**: React Native, Expo, Expo Router, TypeScript, Zustand
- **Backend**: Python, FastAPI
- **APIs**: TMDB, Trakt, Real-Debrid, Xtreme Codes

## What's Been Implemented

### Version 1.4.0 (Latest - December 2025)
- **TV Full-Screen Fix**: Added `android.fullscreen: true` to app.json
- **Enhanced TV Config Plugin**: Updated `withAndroidTV.js` with immersive mode, hardware acceleration, landscape orientation
- **TV Build Profiles**: Added `preview_tv` and `development_tv` EAS profiles with EXPO_TV=1
- **Real-Debrid Auth Debugging**: Added comprehensive logging to diagnose auth issues

### Previous Versions
- Platform.isTV detection throughout the app
- Focus styling for remote control navigation (cyan border + scale effect)
- TV-scaled dimensions in theme.ts (cardWidth, fontSize, spacing)
- hasTVPreferredFocus for initial focus on TV
- 7-column grid on TV, 2-3 columns on mobile
- Cross-platform storage utility for token persistence

## Pending Tasks / Known Issues

### P0 - Critical (Need Testing on Physical Device)
- [ ] **TV Full-Screen Layout**: Changes implemented (`fullscreen: true`, `immersive`, `sensorLandscape`), needs testing on Fire TV/Shield TV
- [ ] **TV Focus Indicators**: Implemented bright cyan highlights with scale + glow for all focusable elements - **MUST TEST ON SHIELD TV**
- [ ] **Real-Debrid Authentication**: Token exchange fixed to use form-urlencoded POST, needs user verification

### P1 - High Priority  
- [x] **Stream Scrapers Integration**: Integrated VidSrc, FlixMomo, and other direct streaming sources into movie/TV detail screens
- [x] **Tabbed Stream Modal**: Added tabbed interface (Debrid/Direct) for stream selection
- [x] **TV Episode Selector**: Added season/episode picker for TV show streaming
- [x] **IPTV Categories API**: Added getLiveCategories method
- [ ] External player integration (VLC via expo-linking) - Not started
- [ ] IPTV login verification - Needs user testing
- [ ] Sky Glass style EPG grid - Current guide is functional but not Sky Glass aesthetic

### P2 - Medium Priority
- [ ] Trakt "Favorites" and "Continue Watching" data sync
- [ ] AllDebrid OAuth flow verification
- [ ] Premiumize OAuth flow verification
- [ ] EPG/Guide functionality check
- [ ] Visible remote focus enhancement

### P3 - Future
- [ ] GitLab CI/CD setup
- [ ] Comprehensive search functionality
- [ ] M3U/.ts file import for custom playlists
- [ ] User onboarding flow

## Build Information
- **Latest Version**: 1.4.0
- **Owner**: thealphaman
- **Author**: Zeus768
- **Project ID**: edd69901-6e43-4552-b8f9-f3e76d355ab7
- **Build Command for TV**: `eas build --profile preview_tv -p android`

## Key Files Reference
- `/app/frontend/app.json` - App config with fullscreen: true
- `/app/frontend/eas.json` - EAS build profiles including TV profiles
- `/app/frontend/plugins/withAndroidTV.js` - Custom TV config plugin
- `/app/frontend/constants/theme.ts` - TV/mobile sizing and colors
- `/app/frontend/app/_layout.tsx` - Main layout with tabs
- `/app/frontend/services/debrid.ts` - Real-Debrid service with debugging
- `/app/frontend/utils/storage.ts` - Cross-platform storage utility
- `/app/frontend/services/streamScrapers.ts` - Stream scraper service (not integrated)
- `/app/backend/debrid_cache_search.py` - Real-Debrid torrent search
