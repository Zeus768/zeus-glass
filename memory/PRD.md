# Zeus Glass - Product Requirements Document

## Original Problem Statement
Build a cross-platform mobile application for Android, Android TV, and Fire TV called "Zeus Glass" with a Sky Glass-style UI aesthetic.

## Session 7 Updates (January 2026)

### Critical Bug Fixes - VERIFIED ✅

#### 1. Zeus Vault Service - FIXED ✅
- **Issue**: `VAULT_BACKUP_DIR` constant was undefined, causing service crashes
- **Fix**: Added constant definition `const VAULT_BACKUP_DIR = getVaultBackupDir();` at line 23
- **Location**: `/app/frontend/services/zeusVaultService.ts`

#### 2. Parental Controls Interface - FIXED ✅
- **Issue**: `ParentalControlSettings` interface missing properties used in settings.tsx
- **Fix**: Added `hideAdultContent`, `hideXXXCategories`, `requirePinForSettings` properties
- **Location**: `/app/frontend/services/parentalControlService.ts`

#### 3. Settings Page Missing Styles - FIXED ✅
- **Issue**: Torrentio card styles were missing (accountNotConnected, accountActions, accountButton, etc.)
- **Fix**: Added missing styles at lines 1849-1872
- **Location**: `/app/frontend/app/settings.tsx`

#### 4. Type Error in Settings - FIXED ✅
- **Issue**: `keyof ParentalSettings` used instead of `keyof ParentalControlSettings`
- **Fix**: Changed to correct type at line 395
- **Location**: `/app/frontend/app/settings.tsx`

### Files Modified This Session
- `/app/frontend/services/zeusVaultService.ts` - Fixed VAULT_BACKUP_DIR constant
- `/app/frontend/services/parentalControlService.ts` - Added missing interface properties
- `/app/frontend/app/settings.tsx` - Fixed type error and added missing styles

### Test Results
- **Backend**: 100% pass rate (18/18 tests)
- **Code Review**: All fixes verified

### New Features Added This Session

#### 5. Live TV Channels Screen - NEW ✅
- **File**: `/app/frontend/app/live-channels.tsx`
- **Features**:
  - Grid view of all IPTV channels with logos
  - Category filtering (All Channels, folders)
  - Channel count per category
  - Focus states for TV navigation
  - Empty state with link to settings
  - Direct playback on channel press

#### 6. Navigation Updated ✅
- **File**: `/app/frontend/app/_layout.tsx`
- **Changes**:
  - Added "LIVE TV" tab pointing to `/live-channels`
  - Renamed old "LIVE TV" to "TV GUIDE"
  - Tab order: HOME → MOVIES → TV SHOWS → PROVIDERS → LIVE TV → TV GUIDE → CATCH UP → SEARCH → VOD → SETTINGS

### Air Dates - Already Implemented ✅
- **TV Episodes**: `frontend/app/tv/[id].tsx` line 379-381 (shows air date)
- **Movies**: `frontend/app/movie/[id].tsx` line 380-384 (shows full release date)

#### 7. Providers Auto-Select - FIXED ✅
- **File**: `/app/frontend/app/providers.tsx`
- **Fix**: Auto-selects first provider (Netflix) on page load
- **Benefit**: Users no longer see empty page, content loads immediately

#### 8. External Player Integration - NEW ✅
- **File**: `/app/frontend/app/player.tsx`
- **Features**:
  - Support for VLC, MX Player, nPlayer, Just Player
  - "Open in External Player" button in top bar
  - Copy URL to clipboard option
  - Graceful handling when player not installed
- **How to use**: Tap the open icon in top-right corner during playback

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
