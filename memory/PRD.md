# Zeus Glass - Product Requirements Document

## Overview
Zeus Glass is a cross-platform mobile streaming application for Android, Android TV, and Fire TV. It replicates the "Sky Glass" UI aesthetic and integrates with multiple streaming services, debrid providers, IPTV, and content tracking via Trakt.

## Tech Stack
- **Frontend**: React Native, Expo, Expo Router, TypeScript, Zustand
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (via MONGO_URL)
- **Key Libraries**: expo-pip, expo-image, expo-linear-gradient, react-native-video, axios, date-fns

## Architecture
```
/app
├── backend/
│   ├── server.py          # FastAPI with proxy, debrid, torrentio, trakt endpoints
│   └── tests/
└── frontend/
    ├── app/               # Expo Router pages
    │   ├── _layout.tsx    # Tab layout, header (Exit/Donate), smaller tabs
    │   ├── index.tsx      # Home: hero + Next Up + Recently Played + Recommendations + carousels
    │   ├── settings.tsx   # Accounts, VPN + Speed Test, Content Filter, Scraper Status, Vault
    │   ├── player.tsx     # Internal player: persistent back btn, 3s auto-hide, VLC intent fix
    │   ├── movie/[id].tsx
    │   ├── tv/[id].tsx
    │   ├── live-tv.tsx    # Content-filtered IPTV
    │   └── tv-guide.tsx   # Null-safe EPG, content-filtered
    ├── components/
    │   ├── Carousel.tsx             # Watched badge support
    │   ├── NextUpCarousel.tsx       # Next unwatched episodes
    │   ├── RecentlyPlayedCarousel.tsx  # Watch history + progress bars
    │   ├── DebridDownloadDialog.tsx
    │   ├── IPTVPipPlayer.tsx
    │   ├── SourcesSearchDialog.tsx
    │   └── FocusableCard.tsx
    ├── services/
    │   ├── contentFilterService.ts  # NSFW filter + link snooper
    │   ├── proxiedFetch.ts
    │   ├── proxyService.ts
    │   ├── debrid.ts, tmdb.ts, trakt.ts, iptv.ts
    │   ├── streamScrapers.ts
    │   └── scraperStatusService.ts
    └── stores/
        └── useWatchedStore.ts   # Watched + Next Up + Recommendations
```

## Completed Features

### TV Guide Crash + IPTV Account Display Fixes (2026-02-15) — v1.6.2
- **CRITICAL fix — TV Guide "Rendered more hooks than during the previous render" crash (P0)**: Root cause was `onViewableItemsChanged={useCallback(...)}` declared **inline as a JSX prop** in `tv-guide.tsx` (line 555). On the first render `loading===true` returned early with N hooks; on subsequent renders the inline `useCallback` was reached, adding an extra hook → React fatal. Hoisted the callback to `handleViewableItemsChanged` before the early `if (loading) return` block. Verified: TV Guide page now renders cleanly on web preview, no error boundary triggered.
- **IPTV account card display fix**: Replaced the duplicated "in 12 days / 12 days" rows with a single row showing the actual expiry date + days-left: e.g. `6 Oct 2026 (235 days left)`. Lifetime accounts now show `Lifetime` in gold.
- **Defensive IPTV exp_date parsing** (`services/iptv.ts` `getAccountInfo`): Handles unix seconds (10-digit), milliseconds (13-digit), ISO date strings, AND alternate field names `expiration_date` / `expiration` — so users always see what the server actually returned, regardless of which Xtreme Codes panel variant they connect to.
- Code-wide scan: confirmed no other `={useCallback/useMemo/useEffect/useState(...)}` inline-hook anti-patterns exist in the project.

### IPTV Login P0 Fix — Android Cleartext Traffic (2026-02-15) — v1.6.1
- **Root cause identified**: Android since API 28 (Android 9, 2018) blocks all HTTP cleartext traffic by default. The IPTV `usesCleartextTraffic` flag was never set in `app.json` or the custom `withAndroidTV` plugin. Almost every Xtreme Codes IPTV server (e.g. `http://jackofclubs.vip:80`) is plain HTTP — so when users entered correct creds in the APK build, axios silently failed and the UI mis-reported "Invalid credentials".
- **Fix (3 layers)**:
  1. Added `"usesCleartextTraffic": true` to `app.json` → `expo.android` (EAS will set the manifest flag on next build).
  2. Belt-and-suspenders: `plugins/withAndroidTV.js` now also sets `android:usesCleartextTraffic="true"` on the `<application>` tag directly.
  3. `services/iptv.ts` `authenticate()` now: honours the protocol the user typed (HTTP-first when input starts with `http://`), distinguishes network errors from cred errors, and throws with a clear message so the UI can show "Cannot reach server" vs "Login failed (creds rejected)".
- `app/settings.tsx` `handleIPTVLogin` now shows the precise error path to the user, including a tip about the URL format.
- **Verified**: Web preview shows v1.6.1 and renders cleanly. ⚠️ The cleartext fix only takes effect on a **rebuilt APK** — user must run EAS build again.

### Service-Agnostic Debrid Resolution + In-App Changelog (2026-02-15) — v1.6.0
- **Debrid resolution decoupled from Real-Debrid (P0 fix)**: `DebridDownloadDialog.tsx` rewritten to auto-detect the active debrid service (priority: TorBox → AllDebrid → Premiumize → Real-Debrid) and dispatch to the correct resolver. TorBox users can now stream cached + uncached torrents end-to-end without RD.
- New per-service resolvers: `resolveTorbox`, `resolveRealDebrid`, `resolveAllDebrid`, `resolvePremiumize` — each handles the service's own magnet-add, polling, file-pick and unrestrict flow.
- Dialog header now shows the *active* service name dynamically (no more hardcoded "Real-Debrid").
- All dialog buttons switched `Pressable` → `TouchableOpacity` for TV D-pad focus.
- `debridCacheService.checkCacheStatus(hashes, service)` now accepts `'realdebrid' | 'torbox'` so cache (⚡) badges work for TorBox users too.
- `debridCacheService.getStreamUrl(hash, fileId?, serviceType?)` accepts an explicit service type.
- `searchCachedMovie` / `searchCachedTV` pick the active service automatically.
- **In-app version + changelog**: 
  - New `services/versionService.ts` (reads version directly from `app.json` — reliable on web), `constants/changelog.ts` (versioned highlights), `components/ChangelogModal.tsx`.
  - Auto-pops modal once after each app update (via `_layout.tsx`).
  - Settings → About now shows dynamic version + a new "What's New / Changelog" pressable that opens the full history.
- App version bumped 1.5.0 → 1.6.0.
- Verified on web preview: Settings displays `Zeus Glass v1.6.0`, changelog modal renders both entries with TorBox bullet.
- Tested with `testing_agent_v3_fork` (iteration_16); P0 version-display bug found & fixed (see CHANGELOG of session for root-cause).

### Trakt Recommendations (2026-03-21)
- Personalized movie and TV show recommendations from Trakt
- `getRecommendedMovies()` and `getRecommendedShows()` API methods
- Resolved to full TMDB objects via `getMoviesByIds()` / `getTVShowsByIds()`
- Displayed in sparkles-icon carousels on home page
- Hidden gracefully when Trakt not connected

### Player Fixes (2026-03-21)
- **Persistent back button** - Always visible on player (not just in controls overlay)
- **VLC fix** - Changed from `vlc://` to `intent://...#Intent;package=org.videolan.vlc;type=video/*;end` for proper video (not audio-only) playback
- **Controls auto-hide** - 3 seconds on TV, resets timer on D-pad focus change
- **Orientation fix** - `resetOrientation` skips on TV (always landscape)

### VPN Speed Test (2026-03-21)
- Speed test button in VPN/Proxy settings section
- Calls `/api/proxy/test` with current proxy config
- Shows latency, IP, and quality assessment in alert

### Content Filter (2026-03-21)
- Blocks adult content from stream links and IPTV categories
- Keyword/domain-based filtering with customizable blocklist
- Link Snooper follows redirects to find clean URLs
- Toggles in Settings: Block Adult Streams, Block Adult Categories
- Integrated into live-tv and tv-guide

### Recently Played (2026-03-21)
- Carousel on home page from watch history
- Shows progress bars, episode labels, time-ago text
- Orange-themed cards with backdrop images

### TV Device Fixes (2026-03-21)
- Settings scroll past Real-Debrid (nestedScrollEnabled)
- Exit App button on TV (BackHandler.exitApp)
- Menu tab sizing reduced ~20%
- TV Guide crash fix (null-safe EPG)
- Donation modal fix (focusable={false} on TV)

### Previous Session Features
- Next Up Carousel, Watched Tick Marks
- VPN/Proxy Integration, Backend Proxy Endpoints
- Debrid Download Dialog, PiP, Scene Scrapers, Source Search
- TV UI Scaling, App Branding v1.5.0

## Pending Tasks
- P2: FlashList performance optimization for TV carousels
- P2: Link Snooper for free scraper adult content filtering (backend + frontend)
- P2: Settings page refactoring (>2600 lines -> sub-components)
- P3: IMDB Login integration
- P3: GitLab CI/CD setup

### Comet + Meteor Scrapers Added (2026-04-18)
- Comet: Updated to `comet.feels.legal` (was elfhosted). Handles both direct URLs and infoHash magnet links.
- Meteor: New scraper added at `meteorfortheweebs.midnightignite.me`. Stremio addon format.
- Both added to `getAllSourcesWithProgress` for real-time scraping status.

### Cloud Tab for Debrid Cached Items (2026-04-18)
- "Cloud" tab added to Movies category bar - shows Real-Debrid and TorBox cloud/cached torrents
- Backend endpoints: `GET /api/debrid/real-debrid/cloud`, `GET /api/debrid/torbox/cloud`
- Displays filename, status, size for each cached item
- Supports pagination for infinite scrolling

### Trakt Deep Integration (2026-04-18)
- **Collection**: Add/remove movies & shows to personal collection with pagination
- **Custom Lists**: Create lists, add/remove items, browse own lists and their items
- **Ratings**: Rate movies/shows (1-10), remove ratings, get rated items
- **Popular Lists**: Browse community popular lists, view items from any user's lists
- **History with Pagination**: Full watch history with pagination
- **Remove from History**: Remove items from watch history
- **Watchlist/Collection/History tabs**: Added to Movies page category bar (shown when Trakt logged in)
- All list methods support pagination for unlimited scrolling

### Native Backend URL Fix (2026-05-22)
- **Root cause**: On native Android (TV/mobile), `getBackendUrl()` returned `''` (empty string) because it was designed for web where relative paths work via Kubernetes ingress. On native APKs, all API calls went to empty string, causing "Backend URL not configured", 405 errors, and failed auth flows.
- **Fix**: All `getBackendUrl()` functions now return `process.env.EXPO_PUBLIC_BACKEND_URL` on native platforms, `''` on web only
- Fixed in: `debrid.ts`, `debugTracker.ts`, `errorLogService.ts`, `proxiedFetch.ts`, `proxyService.ts`, `movies.tsx`, `settings.tsx`
- Also fixed: `shouldUseProxy()` now always returns `true` — native needs proxy for CORS + correct HTTP methods
- This fixes: TorBox 405 error, "Backend URL not configured" debug error, all debrid auth flows on native

### TorBox API Key Direct Entry (2026-05-22)
- TorBox QRAuthModal now supports BOTH device code flow AND direct API key paste
- "Option 1: QR Code" and "Option 2: Paste API Key" with OR divider
- `handleTorboxApiKeySubmit` verifies the key against TorBox API before saving
- Backend `user_code` mapping fixed to try both `user_code` and `code` fields

### Debug Report System (2026-05-16)
- Full interaction/navigation/crash tracker (`debugTracker.ts`) records every press, focus, navigation, crash with timestamps
- "Debug Report" section at TOP of Settings page with one-click GoFile upload
- Backend endpoint `POST /api/debug/upload-gofile` creates JSON bundle, uploads to GoFile anonymously, returns public link
- GoFile link shown on screen for easy sharing with developer
- Also stores bundles in MongoDB for dashboard access
- Navigation tracking integrated globally in `_layout.tsx`

### Settings FlatList Migration (2026-05-16) - DEFINITIVE TV SCROLL FIX
- **Root cause finally identified**: React Native `ScrollView` does NOT auto-scroll on Android TV D-pad focus. This is a known RN limitation — ScrollView only scrolls via touch, never via D-pad focus traversal.
- **Fix**: Replaced `ScrollView` with `FlatList` for the main settings container. Each settings section (Accounts, Vault, VPN, Scrapers, Content Filter, Parental, Player, Debug, About) is a separate FlatList item.
- **Why FlatList works**: FlatList has built-in focus management that auto-scrolls items into view when they receive D-pad focus on Android TV.
- Sections extracted into component functions: `SectionAccounts`, `SectionVault`, `SectionVPN`, `SectionScrapers`, `SectionContentFilter`, `SectionParental`, `SectionPlayer`, `SectionDebug`, `SectionAbout`

### Settings Scroll & Exit Bug Fix (2026-04-18) - Stripped all programmatic scrolling
- **Bug 1 (onn 4k pro)**: "Can't scroll past Real-Debrid, takes back to top" — Caused by `scrollToElement`/`measureLayout` fighting native ScrollView. `removeClippedSubviews={false}` lets Android TV's native focus-driven scroll work on its own.
- **Bug 2 (onn pro box)**: "Tried to login to RD keeps asking to exit" — Global BackHandler was consuming ALL back presses including ones that should close modals. Now only consumes back on root tab screens.
- **Crash fix**: `pathname` variable was used before `usePathname()` hook declaration (TDZ error). Reordered hooks.
- **Approach**: REMOVED all programmatic scroll logic (`scrollToElement`, `measureLayout`, `findNodeHandle`, `trackSectionLayout`, `sectionYPositions`). Trust native Android TV ScrollView entirely.

### Shield TV Startup Crash Fix (2026-04-18)
- **Root cause**: `expo-notifications` `setNotificationHandler()` ran at module-level import time (line 5 of notifications.ts). On NVIDIA Shield TV, this API crashes immediately because TV devices lack full notification support. Since authStore imports notifications.ts, and _layout.tsx imports authStore, the crash happened before the app could even render.
- **Fix 1**: Wrapped `setNotificationHandler()` in try-catch + `Platform.isTV` guard — skips entirely on TV devices
- **Fix 2**: Added `Platform.isTV` early-return to ALL notification methods (requestPermissions, checkAccountExpiry) 
- **Fix 3**: Added `AppErrorBoundary` class component wrapping the entire app in `_layout.tsx` — catches any future render crashes and shows an error screen with "Try Again" button instead of silently closing

### Settings TV Scroll Fix v3 (2026-04-18) - COMPLETE REWRITE
- **Root cause identified**: Previous `handleTVFocus` approach failed because: (1) `onLayout.y` was relative to parent container, not ScrollView, giving wrong scroll coordinates; (2) Off-screen elements NEVER receive focus on Android TV, so the scroll handler never ran
- **Fix**: Added `accessible={false}` to ALL container Views (ScrollView, sections, cards) so Android TV's focus finder can look THROUGH containers to find off-screen Pressable buttons. Added `removeClippedSubviews={false}` to keep off-screen elements in the view hierarchy. Replaced `trackSectionLayout`/`sectionYPositions` with `measureLayout` to get absolute positions relative to ScrollView.
- Covers: Mecool KM9 Pro, Firestick 4K, NVIDIA Shield TV

### TorBox Debrid Integration (2026-04-18)
- Full device code auth flow (RFC 8628) via QR code modal
- Backend proxy endpoints: device-start, device-token, account-info
- Frontend: AccountCard in Settings, QRAuthModal support, authStore integration
- Displays account info (email, plan type, expiry) when connected

### TV Navigation & Back Button Fix (2026-04-18)
- **Global BackHandler** in `_layout.tsx`: Prevents accidental app exit on ALL tab screens on Android TV
- **Detail screens**: `movie/[id].tsx` and `tv/[id].tsx` have `useFocusEffect` BackHandler that calls `router.back()` and dismisses modals first
- **Settings screen**: Own BackHandler via `useFocusEffect` as additional safety
- **Exit App button**: Now shows confirmation dialog ("Are you sure?") instead of instant exit
- Covers: Mecool, Firestick 4K, NVIDIA Shield TV

### TV Navigation Exit Crash Fix (2026-04-18)
- **Root cause**: On Android TV (Mecool, Firestick), D-pad navigation past the last visible element in Settings ScrollView triggered a system "back" event, which Expo Router interpreted as back navigation from a root tab → app exit
- **Fix 1**: Global BackHandler in `_layout.tsx` consumes back press on TV devices (returns true). App can ONLY be exited via the Exit button.
- **Fix 2**: Exit button now shows confirmation dialog ("Are you sure?") instead of instant `BackHandler.exitApp()`
- **Fix 3**: Settings page has its own BackHandler via `useFocusEffect` as additional safety

### Cloud Log Upload System (2026-04-17)
- **Backend**: `POST /api/logs/upload` stores device logs in MongoDB, `GET /api/logs` retrieves them, `GET /api/logs/dashboard` web viewer, `DELETE /api/logs/clear`
- **Frontend**: "Upload to Cloud" button in Settings > Debug & Support section - works on ALL devices including Fire TV
- **Auto-upload on startup**: Silently uploads error logs to cloud every time the app starts (throttled to once per 5 minutes). No user action required on Fire TV.
- **Dashboard**: Web-based log viewer at `/api/logs/dashboard` with stats, filters, search, export JSON
- Keeps existing email/Telegram buttons for mobile devices
- Each device gets a persistent unique ID for tracking

## Bug Fixes (2026-04-17)

### TV D-pad Navigation Fix (P0) - FIXED
- Root cause: Sections below Zeus Vault (VPN, Scrapers, Content Filter, Parental, Player Settings, Debug) did NOT call `scrollToFocused` when focused via D-pad. Also no `onLayout` tracking on their containers.
- Fix: Modified `AccountSection` component to accept `sectionKey` and auto-track Y-position via `onLayout`. Changed ALL `onFocus` handlers from `setFocusedElement()` to `handleTVFocus(elementKey, sectionKey)` which both sets state AND programmatically scrolls the ScrollView. 17 focusable elements now properly trigger scroll.
- Also added missing `Platform` import from react-native.

### Player urlLower Build Error Fix (P1) - FIXED
- Root cause: User's local ad-blocking code declares `const urlLower`, which collides with inline `url?.toLowerCase()` usage.
- Fix: Declared `const urlLower = url?.toLowerCase() || ''` once at component level (line ~75), referenced in useEffect. User's code can now use `urlLower` without redeclaring.

## Test Accounts
- Xtreme Codes: trex-iptv.com:8080
  - Username: trickteddyirl@gmail.com
  - Password: 3cb7f892dc747bb4
