# Zeus Glass - Product Requirements Document

## Original Problem Statement
Build a cross-platform mobile application for Android, Android TV, and Fire TV called "Zeus Glass", with a UI/UX that replicates "Sky Glass" aesthetic. The app integrates streaming services via Debrid providers (Real-Debrid, AllDebrid, Premiumize), IPTV with Xtreme Codes, and movie/TV metadata from TMDB and Trakt.

## User Personas
- **Primary**: Android TV/Fire TV/Shield TV users who want a unified streaming experience
- **Secondary**: Mobile users (Android) who want access to the same content library

## Core Requirements

### Authentication & Accounts ✅
- [x] Real-Debrid OAuth device code flow (with backend proxy for CORS)
- [x] AllDebrid PIN authentication flow (with backend proxy for CORS)
- [x] Premiumize API key authentication
- [x] Trakt OAuth authentication
- [x] IPTV Xtreme Codes login (domain, username, password)

### Trakt Lists Integration ✅ (NEW)
- [x] Continue Watching carousel (from playback progress)
- [x] My Watchlist (Movies) carousel
- [x] My Watchlist (TV Shows) carousel
- [x] Recently Watched history
- [x] Add/Remove from Watchlist functionality
- [x] Carousel icons for visual distinction

### IPTV Features ✅
- [x] Live TV with full channel list from provider
- [x] Category filtering for live channels (114 categories)
- [x] EPG data with Now/Next program info (Base64 decoded)
- [x] VOD Movies with categories and infinite scroll
- [x] VOD TV Shows with categories
- [x] Full-screen video player for IPTV content
- [x] Web storage fallback for reliable config persistence

### TV Focus Highlighting ✅ (ENHANCED)
- [x] Enhanced FocusableView component with stronger glow
- [x] Visible cyan border on focused elements
- [x] Scale transform on focus (1.1x for TV, 1.06x for mobile)
- [x] Shadow/glow effect for depth
- [x] Tab navigation support
- [x] Works with keyboard and D-pad navigation

### Debrid/Streaming Features
- [x] Backend proxy endpoints for CORS bypass
- [x] Torrent search for movies and TV shows
- [x] Stream link resolution via Debrid services
- [x] Cached torrent checking
- [ ] TV show seasons/episodes selection before stream search
- [ ] External player (VLC) integration

### UI/UX ✅
- [x] Sky Glass-inspired dark glassmorphic theme
- [x] Hero carousel on home page
- [x] Category carousels for content browsing
- [x] Account cards in settings with login/logout
- [x] QR code auth modals for Debrid services
- [x] Genre filter pills on Movies/TV Shows pages
- [x] Donate button (links to buymeacoffee.com/zeus768)

## Technical Architecture

### Frontend (React Native / Expo)
- **Framework**: Expo SDK with TypeScript
- **Navigation**: Expo Router (file-based)
- **State**: Zustand for global state
- **Storage**: AsyncStorage with localStorage fallback for web
- **Key Files**:
  - `/app/frontend/services/debrid.ts` - Debrid auth with CORS proxy support
  - `/app/frontend/services/iptv.ts` - IPTV service with web storage fallback
  - `/app/frontend/services/trakt.ts` - Enhanced Trakt API with lists
  - `/app/frontend/store/contentStore.ts` - State with Trakt lists support
  - `/app/frontend/components/FocusableView.tsx` - Enhanced focus component
  - `/app/frontend/components/Carousel.tsx` - With icon support

### Backend (FastAPI / Python)
- **Framework**: FastAPI with uvicorn
- **Database**: MongoDB (via motor async driver)
- **Key Endpoints**:
  - `/api/debrid/real-debrid/*` - Real-Debrid proxy endpoints
  - `/api/debrid/alldebrid/*` - AllDebrid proxy endpoints
  - `/api/debrid/premiumize/*` - Premiumize proxy endpoints
  - `/api/torrents/*` - Torrent search endpoints
  - `/api/debrid/cache/*` - Debrid cache search endpoints

## What's Been Implemented (March 6, 2026)

### Session 1: Critical P0 Fixes
1. **Debrid Authentication** - All 3 services working via backend proxy
2. **IPTV Functionality** - Full implementation with channels, VOD, categories
3. **Storage Reliability** - localStorage fallback for web

### Session 2: Trakt Lists & Focus Enhancement
1. **Trakt Lists Integration**
   - Added getWatchlistMovies(), getWatchlistShows(), getRecentlyWatched()
   - Added loadTraktLists() to content store
   - Home page shows Trakt carousels when authenticated
   - Carousel component supports icons (bookmark, play-circle, heart)

2. **Focus Highlighting Enhancement**
   - Increased border width (5px TV, 4px mobile)
   - Stronger glow effect (25px shadow radius)
   - Higher scale transform (1.12x)
   - Better z-index management

### Testing Results (100% Frontend Pass Rate)
- Home page: Hero + carousels ✅
- Movies page: Grid + 17 genre filters ✅
- TV Shows page: Grid + 16 genre filters ✅
- Settings page: 5 account cards ✅
- VOD page: Movies (30) + TV Shows + categories ✅
- Live TV: Channels (BBC, etc.) + categories ✅
- Focus highlighting: Tab navigation + cyan borders ✅

## Prioritized Backlog

### P0 (Critical) - COMPLETED ✅
- [x] Fix Debrid authentication
- [x] Fix IPTV functionality
- [x] Trakt lists integration
- [x] Focus highlighting enhancement

### P1 (High Priority) - PENDING
- [ ] TV show seasons/episodes flow for Debrid
- [ ] Add scrapers from fmhy.net/video
- [ ] Add "Providers" tab (Netflix, Disney+, Hulu filter)

### P2 (Medium Priority) - PENDING
- [ ] External player (VLC) integration
- [ ] Full-screen mode enforcement on TV
- [ ] PPV section in IPTV guide

### P3 (Low Priority) - PENDING
- [ ] GitLab CI/CD setup
- [ ] Comprehensive search functionality

## Test Credentials
```
IPTV:
  domain: thenewdns.co
  username: patrickteddyirl@gmail.com
  password: 3cb7f892dc747bb4
```

## Known Issues
- Mixed content warnings for HTTP channel logos (IPTV provider issue)
- Console warning: "Unexpected text node" - whitespace in JSX

## Routes Reference
- Home: `/`
- Movies: `/movies`
- TV Shows: `/tv-shows`
- Live TV: `/tv-guide`
- VOD: `/vod`
- Settings: `/settings`
- Search: `/search`
