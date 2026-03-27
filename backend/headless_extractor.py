"""
Headless Browser Video Extractor
Uses Playwright to navigate embed pages and intercept m3u8/mp4 network requests.
This is how Mobiflix-style apps get ad-free direct stream URLs.
"""
import asyncio
import logging
from typing import Optional, Dict, List
from playwright.async_api import async_playwright, Browser, BrowserContext

logger = logging.getLogger(__name__)

# Singleton browser instance (reuse across requests)
_browser: Optional[Browser] = None
_playwright = None

# Ad domains to block — prevents loading ads, speeds up page load
BLOCKED_DOMAINS = [
    'doubleclick.net', 'googlesyndication.com', 'adservice.google.com',
    'pagead2.googlesyndication.com', 'googleadservices.com',
    'popads.net', 'popcash.net', 'popunder.net',
    'adsterra.com', 'adsterratech.com', 'pushance.com',
    'juicyads.com', 'exoclick.com', 'trafficjunky.com',
    'tsyndicate.com', 'propellerads.com', 'revenuehits.com',
    'hilltopads.com', 'clickadu.com', 'admaven.com',
    'richpush.net', 'evadav.com', 'galaksion.com',
    'monetag.com', 'profitablecpm.com', 'bidvertiser.com',
    'clickaine.com', 'acscdn.com', 'disable-devtool',
    'analytics.google.com', 'google-analytics.com',
    'facebook.com/tr', 'connect.facebook.net',
]


async def get_browser() -> Browser:
    """Get or create the singleton browser instance."""
    global _browser, _playwright
    if _browser is None or not _browser.is_connected():
        _playwright = await async_playwright().start()
        _browser = await _playwright.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
            ]
        )
        logger.info("[HeadlessExtractor] Browser launched")
    return _browser


def is_video_url(url: str) -> bool:
    """Check if a URL is a video stream."""
    lower = url.lower()
    return (
        '.m3u8' in lower or
        '.mpd' in lower or
        ('.mp4' in lower and 'ad' not in lower and 'track' not in lower) or
        '.mkv' in lower or
        'master.m3u8' in lower or
        'index.m3u8' in lower or
        '/hls/' in lower or
        'playlist.m3u8' in lower
    )


def should_block(url: str) -> bool:
    """Check if a URL should be blocked (ads, tracking)."""
    lower = url.lower()
    return any(domain in lower for domain in BLOCKED_DOMAINS)


async def extract_from_url(embed_url: str, referer: str = '', timeout_ms: int = 25000) -> List[Dict]:
    """
    Navigate to an embed URL with a headless browser, intercept network requests,
    and return all video stream URLs found.
    """
    found_streams: List[Dict] = []
    
    try:
        browser = await get_browser()
        context: BrowserContext = await browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            extra_http_headers={'Referer': referer} if referer else {},
        )
        
        # Block ad requests via route
        async def block_ads(route):
            if should_block(route.request.url):
                await route.abort()
            else:
                await route.continue_()
        
        await context.route('**/*', block_ads)
        
        page = await context.new_page()
        
        # Intercept network responses for video URLs
        seen_urls = set()
        
        def on_response(response):
            url = response.url
            if is_video_url(url) and url not in seen_urls:
                seen_urls.add(url)
                content_type = response.headers.get('content-type', '')
                quality = 'HD'
                if '1080' in url:
                    quality = '1080p'
                elif '720' in url:
                    quality = '720p'
                elif '480' in url:
                    quality = '480p'
                elif '360' in url:
                    quality = '360p'
                
                found_streams.append({
                    'url': url,
                    'quality': quality,
                    'content_type': content_type,
                })
                logger.info(f"[HeadlessExtractor] Captured video URL: {url[:80]}...")
        
        page.on('response', on_response)
        
        # Also intercept requests to find video URLs
        def on_request(request):
            url = request.url
            if is_video_url(url) and url not in seen_urls:
                seen_urls.add(url)
                quality = 'HD'
                if '1080' in url:
                    quality = '1080p'
                elif '720' in url:
                    quality = '720p'
                elif '480' in url:
                    quality = '480p'
                
                found_streams.append({
                    'url': url,
                    'quality': quality,
                    'content_type': '',
                })
                logger.info(f"[HeadlessExtractor] Captured video request: {url[:80]}...")
        
        page.on('request', on_request)
        
        # Navigate to the embed URL
        try:
            await page.goto(embed_url, wait_until='domcontentloaded', timeout=timeout_ms)
        except Exception as e:
            logger.warning(f"[HeadlessExtractor] Navigation timeout/error (may still find streams): {e}")
        
        # Wait for initial page load
        await asyncio.sleep(3)
        
        # Try clicking any play button
        try:
            play_selectors = [
                'button[class*="play"]', '.play-button', '.btn-play',
                '[aria-label="Play"]', '.jw-icon-playback', '.plyr__control--play',
                'svg[class*="play"]', '.vjs-big-play-button',
                'div[class*="play"]', 'button:has(svg)',
                '.player-play', '#play-btn', '.icon-play',
            ]
            for selector in play_selectors:
                try:
                    btn = await page.query_selector(selector)
                    if btn and await btn.is_visible():
                        await btn.click(force=True)
                        logger.info(f"[HeadlessExtractor] Clicked play button: {selector}")
                        break
                except Exception:
                    continue
        except Exception:
            pass
        
        # Wait for video streams to load after play click
        await asyncio.sleep(5)
        
        # Also check for video src directly in the DOM
        try:
            video_srcs = await page.evaluate('''() => {
                const urls = [];
                document.querySelectorAll('video, video source, source').forEach(el => {
                    const src = el.src || el.getAttribute('src');
                    if (src && (src.includes('.m3u8') || src.includes('.mp4') || src.includes('.mpd'))) {
                        urls.push(src);
                    }
                });
                // Check iframes too
                document.querySelectorAll('iframe').forEach(iframe => {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        iframeDoc.querySelectorAll('video, video source').forEach(el => {
                            const src = el.src || el.getAttribute('src');
                            if (src) urls.push(src);
                        });
                    } catch(e) {}
                });
                return urls;
            }''')
            for src in video_srcs:
                if src not in seen_urls and is_video_url(src):
                    seen_urls.add(src)
                    found_streams.append({
                        'url': src,
                        'quality': 'HD',
                        'content_type': 'video',
                    })
                    logger.info(f"[HeadlessExtractor] Found video src in DOM: {src[:80]}...")
        except Exception as e:
            logger.warning(f"[HeadlessExtractor] DOM extraction failed: {e}")
        
        await context.close()
        
    except Exception as e:
        logger.error(f"[HeadlessExtractor] Error extracting from {embed_url}: {e}")
    
    # Deduplicate and prefer m3u8 over mp4
    unique = {}
    for stream in found_streams:
        url = stream['url']
        if url not in unique:
            unique[url] = stream
    
    result = list(unique.values())
    # Sort: m3u8 first, then by quality
    result.sort(key=lambda s: (
        0 if '.m3u8' in s['url'].lower() else 1,
        0 if '1080' in s.get('quality', '') else 1,
    ))
    
    logger.info(f"[HeadlessExtractor] Extracted {len(result)} streams from {embed_url}")
    return result


async def extract_movie_streams(tmdb_id: str, imdb_id: str = None) -> List[Dict]:
    """Extract direct video streams for a movie from multiple embed sources."""
    sources = [
        ('VidSrc', f'https://vidsrc.to/embed/movie/{tmdb_id}', 'https://vidsrc.to/'),
        ('VidSrc Pro', f'https://vidsrc.pro/embed/movie/{tmdb_id}', 'https://vidsrc.pro/'),
        ('Videasy', f'https://player.videasy.net/movie/{tmdb_id}', 'https://player.videasy.net/'),
        ('AutoEmbed', f'https://player.autoembed.cc/embed/movie/{tmdb_id}', 'https://player.autoembed.cc/'),
        ('Embed.su', f'https://embed.su/embed/movie/{tmdb_id}', 'https://embed.su/'),
        ('SmashyStream', f'https://player.smashy.stream/movie/{tmdb_id}', 'https://player.smashy.stream/'),
        ('SuperEmbed', f'https://multiembed.mov/?video_id={imdb_id or tmdb_id}&tmdb=1', 'https://multiembed.mov/'),
    ]
    
    all_streams = []
    for name, url, referer in sources:
        try:
            streams = await extract_from_url(url, referer, timeout_ms=20000)
            for stream in streams:
                stream['source'] = name
                stream['referer'] = referer
                all_streams.append(stream)
            if streams:
                logger.info(f"[HeadlessExtractor] {name}: Found {len(streams)} streams")
                break  # Stop at first successful source for speed
        except Exception as e:
            logger.warning(f"[HeadlessExtractor] {name} failed: {e}")
            continue
    
    return all_streams


async def extract_tv_streams(
    tmdb_id: str, 
    imdb_id: str = None,
    season: int = 1, 
    episode: int = 1
) -> List[Dict]:
    """Extract direct video streams for a TV episode from multiple embed sources."""
    sources = [
        ('VidSrc', f'https://vidsrc.to/embed/tv/{tmdb_id}/{season}/{episode}', 'https://vidsrc.to/'),
        ('VidSrc Pro', f'https://vidsrc.pro/embed/tv/{tmdb_id}/{season}/{episode}', 'https://vidsrc.pro/'),
        ('Videasy', f'https://player.videasy.net/tv/{tmdb_id}/{season}/{episode}', 'https://player.videasy.net/'),
        ('AutoEmbed', f'https://player.autoembed.cc/embed/tv/{tmdb_id}/{season}/{episode}', 'https://player.autoembed.cc/'),
        ('Embed.su', f'https://embed.su/embed/tv/{tmdb_id}/{season}/{episode}', 'https://embed.su/'),
        ('SmashyStream', f'https://player.smashy.stream/tv/{tmdb_id}/{season}/{episode}', 'https://player.smashy.stream/'),
        ('SuperEmbed', f'https://multiembed.mov/?video_id={imdb_id or tmdb_id}&tmdb=1&s={season}&e={episode}', 'https://multiembed.mov/'),
    ]
    
    all_streams = []
    for name, url, referer in sources:
        try:
            streams = await extract_from_url(url, referer, timeout_ms=20000)
            for stream in streams:
                stream['source'] = name
                stream['referer'] = referer
                all_streams.append(stream)
            if streams:
                logger.info(f"[HeadlessExtractor] {name}: Found {len(streams)} streams for S{season}E{episode}")
                break  # Stop at first successful source for speed
        except Exception as e:
            logger.warning(f"[HeadlessExtractor] {name} failed: {e}")
            continue
    
    return all_streams


async def shutdown_browser():
    """Clean up the browser instance."""
    global _browser, _playwright
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright:
        await _playwright.stop()
        _playwright = None
