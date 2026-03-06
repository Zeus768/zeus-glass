# Zeus Glass Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2025-12-XX

### Added
- **TV Build Profile**: Added `preview_tv` and `development_tv` EAS build profiles with `EXPO_TV=1` environment variable for proper TV builds
- **Enhanced TV Detection**: Improved TV detection in theme.ts to check Platform.isTV, EXPO_TV env var, and screen dimensions
- **Stream Source Integration**: Integrated direct streaming sources (VidSrc, FlixMomo, HydraHD, etc.) into movie/TV detail screens
- **Tabbed Stream Modal**: Added tabbed interface in stream modal to switch between Debrid and Direct stream sources
- **TV Show Episode Selector**: Added season/episode picker UI for TV show streaming
- **Direct Stream Playback**: Direct streams open in browser or external player
- **Poll Status Display**: Added real-time polling status display in auth modal
- **FocusableView Component**: New reusable component for TV remote navigation
- **IPTV Categories API**: Added `getLiveCategories`, `getVODCategories`, `getSeriesCategories` methods
- **VOD TV Series Support**: VOD screen now shows both Movies and TV Shows tabs with infinite scroll
- **Series Episode Browser**: Modal to browse seasons and episodes of TV series
- **Sky Glass Style EPG**: TV Guide shows "NOW" and "NEXT" programs with live badge and metadata
- **Full-Screen Player**: Landscape-locked player with TV remote focus support, play/pause, seek ±10s
- **ALL IPTV Channels**: Removed channel limit - shows all channels (even 20,000+)

### Fixed
- **TV Full-Screen Layout (Critical)**: Added `android.fullscreen: true` to app.json to fix narrow column rendering on Fire TV/Shield TV
- **withAndroidTV Plugin Enhanced**:
  - Added `android:immersive="true"` for true fullscreen mode
  - Added `android:hardwareAccelerated="true"` for smooth TV rendering
  - Changed orientation to `sensorLandscape` for proper TV layout
  - Added `density` to configChanges for better display handling
  - Added `android.hardware.sensor` to uses-feature list
- **Real-Debrid Authentication (Critical)**: 
  - Fixed token exchange using proper form-urlencoded POST instead of query params
  - Added comprehensive `[Real-Debrid]` console logging throughout auth flow
  - Fixed error handling to not throw on expected 403 responses
  - Added detailed status messages during authorization polling
- **TV Remote Focus Indicators (Critical for Shield/Fire TV)**:
  - Tab bar buttons now show bright cyan highlight with white border when focused
  - Account cards (Trakt, Real-Debrid, etc.) show focus state with glow effect
  - Login/Logout buttons scale up 15% with white glow when focused
  - VOD cards and channel cards show focus states for remote navigation
  - Player controls have focus states with scale + glow

### Changed
- Version bumped to 1.4.0
- Updated EAS profiles to include TV-specific builds
- Movie and TV detail screens now fetch both Debrid and Direct streams in parallel
- IPTV now loads ALL channels (no limit)
- VOD uses internal fullscreen player instead of external VLC
- TV Guide uses categories from Xtream API

### Technical Notes
- Users should build with `eas build --profile preview_tv -p android` for TV-optimized APKs
- TV builds set `EXPO_TV=1` which enables TV-specific code paths
- Stream scrapers include: VidSrc, VidSrc Pro, FlixMomo, HydraHD, 2embed, AutoEmbed, SuperEmbed, MoviesAPI, SmashyStream, VidLink
- Focus states use scale(1.15-1.2) + cyan border + white glow for maximum visibility on TV

---

## [1.3.0] - 2026-03-01

### Added
- **Stream Scrapers Service**: New comprehensive streaming source aggregator
  - Torrentio (Stremio addon)
  - MediaFusion (Stremio addon)
  - YTS for movies
  - VidSrc and VidSrc Pro
  - FlixMomo.tv
  - HydraHD.ru
  - Cineby.gd
  - FlickyStream.ru
  - YFlix.to
  - GoMovies.gg
  - MovieParadise.co
  - UTelevision.to
  - Archive.org Disney collection
- **Cross-Platform Storage Utility**: New `storage.ts` utility that uses SecureStore on native platforms and AsyncStorage on web

### Fixed
- **Token Storage on Web/TV**: All auth tokens now properly save using cross-platform storage
  - Real-Debrid tokens save correctly
  - AllDebrid tokens save correctly
  - Premiumize tokens save correctly
  - Trakt tokens save correctly
  - Parental control PIN saves correctly
- **SecureStore errors on web**: Replaced all direct SecureStore calls with cross-platform storage utility

### Changed
- Version bumped to 1.3.0
- Migrated all services from SecureStore to cross-platform storage utility

---

## [1.2.0] - 2026-03-01

### Fixed
- **Real-Debrid OAuth Flow**: Fixed the complete OAuth device authorization flow:
  - Step 1: Get device code
  - Step 2: Poll `/oauth/v2/device/credentials` endpoint to get user-specific `client_id` and `client_secret`
  - Step 3: Exchange credentials for access token
  - This fixes the "appears to authorize but doesn't save" issue
- **Removed unused state variables** from QRAuthModal (clientId, clientSecret)

### Changed
- Version bumped to 1.2.0
- Simplified QRAuthModal polling logic - Real-Debrid now handles credentials internally

---

## [1.1.0] - 2026-03-01

### Added
- **TV Full-Screen Layout Support**: Added custom Expo config plugin (`withAndroidTV.js`) to properly configure AndroidManifest for Fire TV, Shield TV, and Android TV devices
- **LEANBACK_LAUNCHER**: App now appears in Android TV launcher with proper TV app categorization
- **Copy Code Buttons**: Added "Copy Code" and "Copy URL" buttons in QR Auth Modal for easier mobile authentication with Debrid services
- **Prominent Focus Indicators**: Added highly visible focus highlighting for TV remote navigation:
  - Tabs glow cyan and scale up when focused
  - Movie/TV cards show play button overlay and cyan border when focused
  - "PRESS TO PLAY" label on focused content cards

### Fixed
- **TV Portrait Lock**: Removed `android:screenOrientation="portrait"` that was locking app to narrow mobile view on TV
- **IPTV/Xtreme Codes Authentication**: Now tries HTTPS first, then falls back to HTTP for providers that use either protocol
- **All IPTV Endpoints Fixed**: getLiveChannels, getVODContent, getAccountInfo, getEPG all now support HTTPS/HTTP fallback
- **Tab Bar Visibility**: Created custom tab bar component that renders separately from expo-router to ensure tabs are always visible on both mobile and TV

### Changed
- Version bumped to 1.1.0
- Author field added: Zeus768
- Improved TV detection fallback using screen width >= 960px
- Enhanced card scaling (1.15x on TV focus vs 1.08x before)

### Technical
- Added `@react-native-tvos/config-tv` plugin for TV detection
- Created `/plugins/withAndroidTV.js` custom Expo config plugin
- Updated `/android/app/src/main/AndroidManifest.xml` with TV-specific configurations
- Updated `styles.xml` for fullscreen TV themes
- expo-clipboard updated to v8.0.8

---

## [1.0.0] - Initial Release

### Features
- TMDB integration for movie/TV metadata
- Real-Debrid cache search with multiple indexers (Torrentio, Mediafusion, Knightcrawler, Comet, Jackettio)
- Xtreme Codes IPTV support (Live TV, VOD, EPG)
- Trakt authentication
- Parental controls with PIN
- Recording/scheduling for live TV
- Error logging with email/Telegram export
- Donation modal with QR code

### Author
**Zeus768** - https://buymeacoffee.com/zeus768
