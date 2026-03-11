# Zeus Glass - Product Requirements Document

## Original Problem Statement
Build a cross-platform mobile application for Android, Android TV, and Fire TV called "Zeus Glass" with a Sky Glass-style UI aesthetic.

## Core Features Implemented

### Session 5 Updates (March 11, 2026)

#### 1. Comprehensive Search with IPTV VOD
- Search across TMDB (movies/TV shows) + IPTV VOD
- IPTV VOD results display with **gold "IPTV PREMIUM" badge**
- Filter tabs: All, Movies, TV Shows, IPTV Premium
- VOD results shown only when user has IPTV credentials

#### 2. ResolveURL Service (All Hosters)
- Support for Real-Debrid, AllDebrid, Premiumize
- Automatic link resolution through all configured debrid services
- Torrent/magnet resolution support
- Quality detection from filenames
- File size formatting

#### 3. Subtitle Service
- OpenSubtitles API integration
- Manual subtitle file upload support
- Custom subtitle size settings: Small (18px), Medium (24px), Large (32px), Extra-Large (42px)
- Subtitle styling: background color, text color
- Preferred language selection
- Auto-download option

#### 4. Parental Controls
- Auto-enable when adult content detected in IPTV
- 4-digit PIN setup forced before accessing adult content
- PIN verification for unlocking
- Settings option to disable with PIN
- 30-minute unlock duration
- Clear instructions for removal in Settings

#### 5. Stream Filter Service
- Filter by: Quality (4K, REMUX, 1080p, 720p, 480p)
- Filter by: Size (min/max GB)
- Filter by: Hoster (preferred/excluded)
- Sort by: Quality, Size, Seeders, Hoster
- Reset filters on new movie selection
- Default settings saved in AsyncStorage

#### 6. One-Click Play Settings
- Enable/disable one-click auto-play
- Preferred quality selection (4K, REMUX, 1080p, etc.)
- Preferred hoster selection
- Preferred debrid service
- Min/max file size constraints
- IPTV Premium prioritization option

### Settings Page Updates
- **Player Settings** section added:
  - Subtitles configuration (size, auto-download)
  - OpenSubtitles account setup
  - One-Click Play configuration

### Services Created
1. `/app/frontend/services/resolveUrl.ts` - Debrid link resolver
2. `/app/frontend/services/subtitleService.ts` - Subtitle management
3. `/app/frontend/services/streamFilterService.ts` - Stream filtering & one-click play
4. `/app/frontend/services/parentalControlService.ts` - Parental controls (enhanced)

### Search Page Enhancements
- IPTV VOD search integration
- Gold badge for premium IPTV content
- Tab filtering (All/Movies/TV Shows/IPTV Premium)

## Previous Session Fixes (Session 4)
- Enhanced TV focus highlighting (white borders, cyan glow, 1.15-1.18x scale)
- Player fullscreen with expo-navigation-bar
- TV Guide using FlashList for performance
- Direct streams open in player WebView

## Prioritized Backlog

### P0 (Critical)
- [ ] Complete subtitle modal UI with all settings
- [ ] Complete one-click play modal UI
- [ ] Stream filter modal in movie detail page
- [ ] Test on real Shield TV / Fire TV device

### P1 (High Priority)
- [ ] Add more scrapers from fmhy.net/video
- [ ] "Providers" tab for filtering by streaming service
- [ ] TV show seasons/episodes selection flow

### P2 (Medium Priority)
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
