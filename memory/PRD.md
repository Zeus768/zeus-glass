# Zeus Glass - Product Requirements Document

## Original Problem Statement
Build a cross-platform mobile application for Android, Android TV, and Fire TV called "Zeus Glass", with a UI/UX that replicates "Sky Glass" aesthetic. The app integrates streaming services via Debrid providers (Real-Debrid, AllDebrid, Premiumize), IPTV with Xtreme Codes, and movie/TV metadata from TMDB and Trakt.

## What's Been Fixed (Session 3 - March 6, 2026)

### Issues Fixed From User Feedback:

1. **Player Screen Improvements**
   - Added `Stack.Screen options={{ headerShown: false }}` for true fullscreen
   - Fixed screen orientation lock to landscape during playback
   - Added proper orientation reset to portrait when exiting player
   - Added WebView player for embed sources (VidSrc, etc.)
   - Status bar now hidden during playback

2. **Stream Scrapers Rewrite**
   - Rewrote all embed scrapers to use working URLs
   - Added: VidSrc.xyz, SuperEmbed, SmashyStream, 2Embed, AutoEmbed
   - Fixed Torrentio to require valid IMDB ID (starts with 'tt')
   - Added logging for debugging stream fetching
   - Added size and seeders info to torrent results

3. **EPG & TV Guide Caching**
   - Added 5-minute EPG cache to prevent crashes from API overload
   - Added 10-minute channels cache
   - Added 30-minute categories cache
   - Added batch EPG loading with rate limiting (5 concurrent requests)
   - Added cache clearing on logout/config change

4. **Trakt Lists Integration**
   - Watchlist Movies carousel
   - Watchlist TV Shows carousel
   - Continue Watching carousel
   - Recently Watched history
   - Add/Remove from Watchlist functionality

5. **Focus Highlighting Enhancement**
   - Increased border width (5px TV, 4px mobile)
   - Stronger glow effect (25px shadow radius)
   - Higher scale transform (1.12x)

## Known Remaining Issues

1. **Debrid Links (0 showing)**: This happens when:
   - User is not authenticated with Real-Debrid/AllDebrid/Premiumize
   - Movie/show doesn't have a valid IMDB ID
   - Torrentio server is down/slow
   - Note: User MUST complete OAuth auth flow first

2. **Direct Links Not Playing**: 
   - Some embed sites may be blocked by the provider
   - The WebView player now handles embed URLs properly
   - User may need to interact with the player (click play, close ads)

3. **Shield TV Focus**: 
   - Focus highlighting is implemented but needs testing on real device
   - The styles use cyan border + scale transform + shadow glow

## Test Credentials (DO NOT COMMIT)
IPTV credentials stored separately for testing purposes.

## Technical Changes Summary

### Files Modified:
- `/app/frontend/app/player.tsx` - Fullscreen fix, orientation lock, WebView for embeds
- `/app/frontend/services/iptv.ts` - EPG caching, batch loading, cache clear
- `/app/frontend/services/streamScrapers.ts` - New embed sources, better torrent handling
- `/app/frontend/services/trakt.ts` - Watchlist, collection, history functions
- `/app/frontend/store/contentStore.ts` - Trakt lists loading
- `/app/frontend/components/Carousel.tsx` - Icon support
- `/app/frontend/components/FocusableView.tsx` - Enhanced focus styles

### Architecture:
- **Caching Strategy**: In-memory caches with TTL (EPG: 5min, Channels: 10min, Categories: 30min)
- **Player Types**: Native video player for direct streams, WebView for embed sources
- **Orientation**: Lock to landscape on player open, unlock/reset on close

## Prioritized Backlog

### P0 (Critical) - IN PROGRESS
- [ ] Test Debrid auth flow end-to-end on real device
- [ ] Test focus highlighting on Shield TV / Fire TV
- [ ] Test orientation reset on mobile after player exit

### P1 (High Priority)
- [ ] TV show seasons/episodes selection flow
- [ ] Add scrapers from fmhy.net/video
- [ ] "Providers" tab for filtering by streaming service

### P2 (Medium Priority)
- [ ] External player (VLC) integration
- [ ] PPV section in IPTV guide

### P3 (Low Priority)
- [ ] GitLab CI/CD setup
- [ ] Comprehensive search functionality
