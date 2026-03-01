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

## What's Been Implemented (March 2026)

### TV Compatibility Overhaul ✅
- Platform.isTV detection throughout the app
- Focus styling for remote control navigation (cyan border + scale effect)
- TV-scaled dimensions in theme.ts (cardWidth, fontSize, spacing)
- hasTVPreferredFocus for initial focus on TV
- 7-column grid on TV, 2-3 columns on mobile

### Home Screen ✅
- Hero section with trending movie backdrop
- Watch Now/Playlist/Info buttons
- Trending Movies, Popular Movies, In Cinemas carousels
- Trending TV Shows, Popular TV Shows carousels
- Continue Watching and Favorites carousels (when data exists)

### Movies & TV Shows Screens ✅
- Horizontal scrollable genre filter tabs
- Grid layout with infinite scrolling (FlatList + onEndReached)
- Rating badges on each card
- Focus overlay with play icon on TV

### Settings Screen ✅
- Account cards: Trakt, Real-Debrid, AllDebrid, Premiumize, Premium IPTV
- Parental controls section
- Debug/support section
- Error logging

### Donation Modal ✅
- QR code for buymeacoffee.com/zeus768
- Buy Me a Coffee button
- TV-sized layout

## Pending Tasks

### P1 - High Priority
- [ ] External player integration (VLC via expo-linking)
- [ ] Trakt "Favorites" and "Continue Watching" data sync

### P2 - Medium Priority
- [ ] AllDebrid OAuth flow implementation
- [ ] Premiumize OAuth flow implementation
- [ ] M3U/.ts file import for custom playlists
- [ ] Comprehensive search functionality

### P3 - Future
- [ ] User onboarding flow
- [ ] Offline favorites caching
- [ ] Push notifications for new content

## Build Information
- **Latest Build**: March 1, 2026
- **Build URL**: https://expo.dev/accounts/thealphaman/projects/zeus-glass/builds/637d4466-aab0-4bdf-aaf8-7e6eb57ae179
- **EAS Profile**: preview (APK distribution)
- **Owner**: thealphaman
- **Project ID**: edd69901-6e43-4552-b8f9-f3e76d355ab7

## Key Files Reference
- `/app/frontend/constants/theme.ts` - TV/mobile sizing and colors
- `/app/frontend/app/_layout.tsx` - Main layout with tabs
- `/app/frontend/app/index.tsx` - Home screen
- `/app/frontend/app/movies.tsx` - Movies grid with infinite scroll
- `/app/frontend/components/Carousel.tsx` - Horizontal content carousel
- `/app/frontend/services/tmdb.ts` - TMDB API service
- `/app/backend/debrid_cache_search.py` - Real-Debrid torrent search
