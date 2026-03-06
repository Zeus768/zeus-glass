# Zeus Glass - Product Requirements Document

## Original Problem Statement
Build a cross-platform mobile application for Android, Android TV, and Fire TV called "Zeus Glass", with a UI/UX that replicates "Sky Glass" aesthetic. The app integrates streaming services via Debrid providers (Real-Debrid, AllDebrid, Premiumize), IPTV with Xtreme Codes, and movie/TV metadata from TMDB and Trakt.

## User Personas
- **Primary**: Android TV/Fire TV/Shield TV users who want a unified streaming experience
- **Secondary**: Mobile users (Android) who want access to the same content library

## Core Requirements

### Authentication & Accounts
- [x] Real-Debrid OAuth device code flow
- [x] AllDebrid PIN authentication flow
- [x] Premiumize API key authentication
- [x] Trakt OAuth authentication
- [x] IPTV Xtreme Codes login (domain, username, password)

### IPTV Features
- [x] Live TV with full channel list from provider
- [x] Category filtering for live channels
- [x] EPG data with Now/Next program info (Base64 decoded)
- [x] VOD Movies with categories and infinite scroll
- [x] VOD TV Shows with categories
- [x] Full-screen video player for IPTV content

### Debrid/Streaming Features
- [x] Torrent search for movies and TV shows
- [x] Stream link resolution via Debrid services
- [x] Cached torrent checking
- [ ] TV show seasons/episodes selection before stream search
- [ ] External player (VLC) integration

### UI/UX
- [x] Sky Glass-inspired dark glassmorphic theme
- [x] Hero carousel on home page
- [x] Category carousels for content browsing
- [x] Account cards in settings with login/logout
- [x] QR code auth modals for Debrid services
- [ ] TV remote focus highlighting (needs improvement for real TV)

## Technical Architecture

### Frontend (React Native / Expo)
- **Framework**: Expo SDK with TypeScript
- **Navigation**: Expo Router (file-based)
- **State**: Zustand for global state
- **Storage**: AsyncStorage with localStorage fallback for web
- **Key Files**:
  - `/app/frontend/services/debrid.ts` - Debrid auth with CORS proxy support
  - `/app/frontend/services/iptv.ts` - IPTV service with web storage fallback
  - `/app/frontend/components/QRAuthModal.tsx` - Auth modal component
  - `/app/frontend/app/tv-guide.tsx` - Live TV guide
  - `/app/frontend/app/vod.tsx` - VOD movies and TV shows

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

### Critical Fixes Completed
1. **Debrid Authentication (P0 - FIXED)**
   - Real-Debrid OAuth device code flow now working via backend proxy
   - AllDebrid PIN authentication working via backend proxy
   - Premiumize direct API key entry flow implemented
   - Backend proxy endpoints added to bypass CORS on web

2. **IPTV Functionality (P0 - FIXED)**
   - Live TV page shows all channels with category filtering
   - VOD Movies page with categories and metadata
   - VOD TV Shows page with series support
   - EPG data fetching with Base64 title/description decoding
   - localStorage fallback for web storage reliability

3. **Storage Reliability**
   - Added webStorage helper for localStorage fallback on web
   - IPTV config persists correctly across page reloads

### Testing Results (100% Pass Rate)
- Real-Debrid auth: QR code + user code + polling ✅
- AllDebrid auth: PIN code + URL + polling ✅
- Premiumize auth: API key input form ✅
- IPTV Login: Works with provided credentials ✅
- Live TV: Channels + categories + EPG loading ✅
- VOD Movies: 30+ movies with categories ✅
- VOD TV Shows: 60+ shows with categories ✅

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] Fix Debrid authentication (Real-Debrid, AllDebrid, Premiumize)
- [x] Fix IPTV functionality (channels, VOD, categories)

### P1 (High Priority) - PENDING
- [ ] TV focus highlighting improvement for real TV devices
- [ ] TV show seasons/episodes flow for Debrid
- [ ] Add scrapers from fmhy.net/video
- [ ] Add "Providers" tab (Netflix, Disney+, Hulu filter)

### P2 (Medium Priority) - PENDING
- [ ] External player (VLC) integration
- [ ] Trakt lists integration (Favorites, Continue Watching)
- [ ] Full-screen mode enforcement on TV

### P3 (Low Priority) - PENDING
- [ ] GitLab CI/CD setup
- [ ] Comprehensive search functionality
- [ ] PPV section in IPTV guide

## Known Issues
- Mixed content warnings for HTTP channel logos (IPTV provider issue)
- IPTV modal Login button may need force click (LOW priority)
- EPG "Now/Next" only shows when program times match current time

## Test Credentials
```
IPTV:
  domain: thenewdns.co
  username: patrickteddyirl@gmail.com
  password: 3cb7f892dc747bb4
```

## Files Modified in This Session
- `/app/frontend/services/debrid.ts` - Complete rewrite with proxy support
- `/app/frontend/services/iptv.ts` - Added web storage fallback
- `/app/frontend/components/QRAuthModal.tsx` - Updated for all auth flows
- `/app/backend/server.py` - Added Debrid proxy endpoints
