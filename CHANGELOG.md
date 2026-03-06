# Zeus Glass Changelog

All notable changes to this project will be documented in this file.

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
