# Zeus Glass - Product Requirements Document

## Original Problem Statement
Build a cross-platform mobile application for Android, Android TV, and Fire TV called "Zeus Glass" with a Sky Glass-style UI aesthetic.

## Session 6 Updates (December 2025)

### Critical Bug Fixes

#### 1. Debrid Links Not Showing - FIXED ✅
- **Issue**: Movies were not showing debrid links because IMDB ID wasn't being passed
- **Fix**: Modified `tmdbService.getMovieDetails()` and `getTVShowDetails()` to include `external_ids` in API request
- **Result**: IMDB ID now extracted from TMDB response and passed to debrid cache search

#### 2. App Crashes/Force Close Prevention ✅
- **Added**: `ErrorBoundary` component to wrap the entire app
- **Location**: `/app/frontend/components/ErrorBoundary.tsx`
- **Benefit**: Graceful error handling prevents full app crashes, shows retry button

#### 3. Mobile Carousel Compression - FIXED ✅
- **Issue**: Carousel cards were compressed on mobile
- **Fix**: Reduced mobile card sizes to `130x195` (from 150x220) for better fit
- **Location**: `/app/frontend/constants/theme.ts`

### New Features

#### 4. Trending Categories Added ✅
- **Movies Page**: Added "Trending" and "Top Rated" filter buttons with flame/star icons
- **TV Shows Page**: Added "Trending" and "Top Rated" filter buttons with flame/star icons
- **Home Page**: Reordered carousels to show Trending first with flame icons
- **Status**: IMPLEMENTED & CODE VERIFIED

### API Updates

#### 5. Backend Debrid Search Enhanced ✅
- **Endpoint**: `/api/debrid/cache/search/movie`
- **Change**: Now accepts and passes `imdb_id` parameter to indexers
- **Logging**: Added detailed logging for debugging
- **Status**: TESTED - 18/18 backend tests passed

### Files Modified
- `/app/frontend/services/tmdb.ts` - Added external_ids to movie/TV detail requests
- `/app/frontend/types/index.ts` - Added imdb_id to Movie and TVShow interfaces
- `/app/frontend/app/movies.tsx` - Added Trending/Top Rated category buttons
- `/app/frontend/app/tv-shows.tsx` - Added Trending/Top Rated category buttons
- `/app/frontend/app/index.tsx` - Updated carousel order with flame icons
- `/app/frontend/app/_layout.tsx` - Wrapped app with ErrorBoundary
- `/app/frontend/app/movie/[id].tsx` - Enhanced debrid search with IMDB ID
- `/app/frontend/constants/theme.ts` - Adjusted mobile card sizes
- `/app/backend/server.py` - Enhanced logging for debrid cache search

### Files Created
- `/app/frontend/components/ErrorBoundary.tsx` - Error boundary component

## Session 5 Updates (March 11, 2026)

### Features Implemented & Tested ✅

#### 1. Comprehensive Search with IPTV VOD
- Search across TMDB (movies/TV shows) + IPTV VOD
- IPTV VOD results display with **gold "IPTV PREMIUM" badge**
- Filter tabs: All, Movies, TV Shows, IPTV Premium
- VOD results shown only when user has IPTV credentials
- **Status**: TESTED & WORKING

#### 2. Providers Page (Netflix, Disney+, etc.)
- New `/providers` route with streaming service grid
- Services: Netflix, Disney+, Amazon Prime, Hulu, HBO Max, Apple TV+, Paramount+, Peacock, Showtime, Starz, Crunchyroll, MUBI, Curiosity Stream, BritBox, Stan, Now TV, Sky Go, Tubi, Pluto
- Movies / TV Shows toggle
- Content grid with FlashList for performance
- **Status**: TESTED & WORKING

#### 3. ResolveURL Service (All Hosters)
- Support for Real-Debrid, AllDebrid, Premiumize
- Automatic link resolution through all configured debrid services
- Torrent/magnet resolution support
- Quality detection from filenames
- **Status**: IMPLEMENTED

#### 4. Additional Stream Scrapers (fmhy.net)
Added 7 new scrapers:
- VidSrc.nl
- Embed.su
- MoviesAPI
- Videasy
- Rive
- FrEmbed
- WarezCDN
- **Status**: IMPLEMENTED

#### 5. Subtitle Service
- OpenSubtitles API integration
- Manual subtitle file upload support
- Custom subtitle size settings: Small (18px), Medium (24px), Large (32px), Extra-Large (42px)
- Preferred language selection
- Auto-download option
- **Status**: IMPLEMENTED

#### 6. Stream Filter Modal
- Filter by: Quality (4K, REMUX, 1080p, 720p, 480p)
- Filter by: Size (min/max GB)
- Sort by: Quality, Size, Seeders
- Quick filter chips in stream links modal
- Reset filters on new movie selection
- **Status**: IMPLEMENTED

#### 7. One-Click Play Settings
- Enable/disable one-click auto-play
- Preferred quality selection
- Preferred hoster selection
- Preferred debrid service
- IPTV Premium prioritization option
- **Status**: IMPLEMENTED

#### 8. Quick Settings Player Overlay
- Settings button on player overlay
- Subtitle toggle (ON/OFF)
- Subtitle size quick selection (S/M/L/XL)
- Slide-out panel design
- **Status**: IMPLEMENTED

#### 9. Parental Controls Enhancement
- Auto-enable on adult content detection
- PIN setup forced before access
- Settings option to disable with PIN
- Clear instructions for removal
- **Status**: IMPLEMENTED

### Settings Page Updates
- **Player Settings** section added with:
  - Subtitles (Enabled • Size: medium) - Configure button
  - OpenSubtitles (Not configured) - Setup button
  - One-Click Play (Disabled) - Configure button
- **Status**: TESTED & WORKING

### Services Created
1. `/app/frontend/services/resolveUrl.ts` - Debrid link resolver
2. `/app/frontend/services/subtitleService.ts` - Subtitle management
3. `/app/frontend/services/streamFilterService.ts` - Stream filtering & one-click play
4. `/app/frontend/services/providersService.ts` - TMDB provider discovery
5. `/app/frontend/services/parentalControlService.ts` - Enhanced parental controls

### Pages Created
1. `/app/frontend/app/providers.tsx` - Providers browse page

### Navigation Updates
- Added **PROVIDERS** tab to navigation bar

## Previous Session Fixes (Session 4)
- Enhanced TV focus highlighting (white borders, cyan glow, 1.15-1.18x scale)
- Player fullscreen with expo-navigation-bar
- TV Guide using FlashList for performance
- Direct streams open in player WebView

## Test Results
- **Frontend Testing**: 100% pass rate
- **All 6 core features verified working**
- **Minor issue**: Some provider logos (Showtime, Starz, Stan, Sky Go) appear blank - TMDB CDN issue

## Prioritized Backlog

### P0 (Critical) - COMPLETED ✅
- [x] Comprehensive search with IPTV VOD
- [x] Providers page (Netflix, Disney+, etc.)
- [x] Additional scrapers from fmhy.net
- [x] Stream filter modal
- [x] Quick Settings player overlay
- [x] Player Settings in Settings page

### P1 (High Priority)
- [ ] Complete subtitle modal UI with language picker
- [ ] Complete one-click play modal UI
- [ ] Test on real Shield TV / Fire TV device

### P2 (Medium Priority)
- [ ] TV show seasons/episodes selection flow
- [ ] External player (VLC) integration
- [ ] PPV section in IPTV guide

### P3 (Low Priority)
- [ ] GitLab CI/CD setup
- [ ] Comprehensive search voice input

## Tech Stack
- **Frontend**: React Native, Expo, Expo Router, TypeScript, Zustand
- **Backend**: Python, FastAPI (Debrid auth proxies)
- **State**: AsyncStorage for persistence
- **Video**: expo-av (Video), react-native-webview (embeds)
- **Performance**: @shopify/flash-list for large lists
