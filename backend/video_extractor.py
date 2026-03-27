"""
Video URL Extractor - Extracts actual m3u8/mp4 stream URLs from embed pages.
Works like Mobiflix - returns clean playable URLs without ads/popups.
"""
import httpx
import re
import json
import logging
import base64
from urllib.parse import urljoin, urlparse, unquote
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
}

# Common ad-related URL patterns to filter out
AD_PATTERNS = [
    'popads', 'popunder', 'adserve', 'doubleclick', 'googlesyndication',
    'adsbygoogle', 'pagead', 'analytics', 'tracker', 'clickease',
]


def is_m3u8_url(url: str) -> bool:
    return '.m3u8' in url.lower() or 'playlist' in url.lower()


def is_mp4_url(url: str) -> bool:
    return '.mp4' in url.lower() and 'ad' not in url.lower()


def is_video_url(url: str) -> bool:
    return is_m3u8_url(url) or is_mp4_url(url) or '.mkv' in url.lower()


def extract_urls_from_text(text: str) -> List[str]:
    """Extract all HTTP URLs from a text string."""
    url_pattern = r'https?://[^\s\'"<>\)\]\}\\]+'
    urls = re.findall(url_pattern, text)
    return [u.rstrip(',;.') for u in urls]


async def extract_video_from_page(url: str, referer: str = '') -> Optional[str]:
    """Generic: Fetch a page and look for m3u8/mp4 URLs in the HTML/JS."""
    try:
        headers = {**BROWSER_HEADERS, 'Referer': referer or url}
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(url, headers=headers)
            text = resp.text
            
            # Look for m3u8 URLs first (preferred for streaming)
            all_urls = extract_urls_from_text(text)
            m3u8_urls = [u for u in all_urls if is_m3u8_url(u) and not any(ad in u.lower() for ad in AD_PATTERNS)]
            if m3u8_urls:
                logger.info(f"[Extractor] Found m3u8 URL from {urlparse(url).netloc}")
                return m3u8_urls[0]
            
            # Look for mp4 URLs
            mp4_urls = [u for u in all_urls if is_mp4_url(u) and not any(ad in u.lower() for ad in AD_PATTERNS)]
            if mp4_urls:
                logger.info(f"[Extractor] Found mp4 URL from {urlparse(url).netloc}")
                return mp4_urls[0]
                
            # Check for JSON-embedded sources (common pattern)
            json_sources = re.findall(r'sources\s*[:=]\s*(\[.*?\])', text, re.DOTALL)
            for src_json in json_sources:
                try:
                    sources = json.loads(src_json.replace("'", '"'))
                    for source in sources:
                        if isinstance(source, dict):
                            src_url = source.get('file') or source.get('src') or source.get('url', '')
                            if is_video_url(src_url):
                                logger.info(f"[Extractor] Found video in JSON sources from {urlparse(url).netloc}")
                                return src_url
                        elif isinstance(source, str) and is_video_url(source):
                            return source
                except (json.JSONDecodeError, TypeError):
                    continue
            
            # Check for source/file patterns in JS
            file_patterns = [
                r'"file"\s*:\s*"([^"]+\.m3u8[^"]*)"',
                r"'file'\s*:\s*'([^']+\.m3u8[^']*)'",
                r'"src"\s*:\s*"([^"]+\.m3u8[^"]*)"',
                r'"file"\s*:\s*"([^"]+\.mp4[^"]*)"',
                r"source\s*=\s*['\"]([^'\"]+\.m3u8[^'\"]*)['\"]",
                r"video\.src\s*=\s*['\"]([^'\"]+)['\"]",
            ]
            for pattern in file_patterns:
                matches = re.findall(pattern, text)
                for match in matches:
                    if is_video_url(match) and not any(ad in match.lower() for ad in AD_PATTERNS):
                        logger.info(f"[Extractor] Found video via regex from {urlparse(url).netloc}")
                        return match
            
    except Exception as e:
        logger.warning(f"[Extractor] Failed to extract from {url}: {e}")
    return None


async def extract_vidsrc(tmdb_id: str, media_type: str = 'movie', season: int = None, episode: int = None) -> Optional[Dict]:
    """Extract video URL from VidSrc.to"""
    try:
        if media_type == 'movie':
            embed_url = f'https://vidsrc.to/embed/movie/{tmdb_id}'
        else:
            embed_url = f'https://vidsrc.to/embed/tv/{tmdb_id}/{season}/{episode}'
        
        headers = {**BROWSER_HEADERS, 'Referer': 'https://vidsrc.to/'}
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(embed_url, headers=headers)
            text = resp.text
            
            # VidSrc uses AJAX to load sources
            # Try to find the sources endpoint
            data_id_match = re.search(r'data-id="([^"]+)"', text)
            if data_id_match:
                data_id = data_id_match.group(1)
                sources_url = f'https://vidsrc.to/ajax/embed/episode/{data_id}/sources'
                sources_resp = await client.get(sources_url, headers=headers)
                if sources_resp.status_code == 200:
                    sources_data = sources_resp.json()
                    if 'result' in sources_data:
                        for source in sources_data['result']:
                            source_id = source.get('id', '')
                            source_url = f'https://vidsrc.to/ajax/embed/source/{source_id}'
                            src_resp = await client.get(source_url, headers=headers)
                            if src_resp.status_code == 200:
                                src_data = src_resp.json()
                                enc_url = src_data.get('result', {}).get('url', '')
                                if enc_url:
                                    # Try to decode if base64
                                    try:
                                        decoded = base64.b64decode(enc_url).decode()
                                        if is_video_url(decoded):
                                            return {'url': decoded, 'source': 'VidSrc', 'referer': 'https://vidsrc.to/'}
                                    except Exception:
                                        pass
                                    # Try as direct URL
                                    video = await extract_video_from_page(enc_url, 'https://vidsrc.to/')
                                    if video:
                                        return {'url': video, 'source': 'VidSrc', 'referer': 'https://vidsrc.to/'}
            
            # Fallback: check raw page
            video = await extract_video_from_page(embed_url, 'https://vidsrc.to/')
            if video:
                return {'url': video, 'source': 'VidSrc', 'referer': 'https://vidsrc.to/'}
                
    except Exception as e:
        logger.warning(f"[Extractor:VidSrc] Error: {e}")
    return None


async def extract_vidsrc_pro(tmdb_id: str, media_type: str = 'movie', season: int = None, episode: int = None) -> Optional[Dict]:
    """Extract video URL from VidSrc Pro"""
    try:
        if media_type == 'movie':
            embed_url = f'https://vidsrc.pro/embed/movie/{tmdb_id}'
        else:
            embed_url = f'https://vidsrc.pro/embed/tv/{tmdb_id}/{season}/{episode}'
        
        video = await extract_video_from_page(embed_url, 'https://vidsrc.pro/')
        if video:
            return {'url': video, 'source': 'VidSrc Pro', 'referer': 'https://vidsrc.pro/'}
    except Exception as e:
        logger.warning(f"[Extractor:VidSrcPro] Error: {e}")
    return None


async def extract_videasy(tmdb_id: str, media_type: str = 'movie', season: int = None, episode: int = None) -> Optional[Dict]:
    """Extract video URL from Videasy"""
    try:
        if media_type == 'movie':
            embed_url = f'https://player.videasy.net/movie/{tmdb_id}'
        else:
            embed_url = f'https://player.videasy.net/tv/{tmdb_id}/{season}/{episode}'
        
        video = await extract_video_from_page(embed_url, 'https://player.videasy.net/')
        if video:
            return {'url': video, 'source': 'Videasy', 'referer': 'https://player.videasy.net/'}
    except Exception as e:
        logger.warning(f"[Extractor:Videasy] Error: {e}")
    return None


async def extract_autoembed(tmdb_id: str, media_type: str = 'movie', season: int = None, episode: int = None) -> Optional[Dict]:
    """Extract video URL from AutoEmbed"""
    try:
        if media_type == 'movie':
            embed_url = f'https://player.autoembed.cc/embed/movie/{tmdb_id}'
        else:
            embed_url = f'https://player.autoembed.cc/embed/tv/{tmdb_id}/{season}/{episode}'
        
        video = await extract_video_from_page(embed_url, 'https://player.autoembed.cc/')
        if video:
            return {'url': video, 'source': 'AutoEmbed', 'referer': 'https://player.autoembed.cc/'}
    except Exception as e:
        logger.warning(f"[Extractor:AutoEmbed] Error: {e}")
    return None


async def extract_superembed(tmdb_id: str, imdb_id: str = None, media_type: str = 'movie', season: int = None, episode: int = None) -> Optional[Dict]:
    """Extract video URL from SuperEmbed/MultiEmbed"""
    try:
        video_id = imdb_id or tmdb_id
        if media_type == 'movie':
            embed_url = f'https://multiembed.mov/?video_id={video_id}&tmdb=1'
        else:
            embed_url = f'https://multiembed.mov/?video_id={video_id}&tmdb=1&s={season}&e={episode}'
        
        video = await extract_video_from_page(embed_url, 'https://multiembed.mov/')
        if video:
            return {'url': video, 'source': 'SuperEmbed', 'referer': 'https://multiembed.mov/'}
    except Exception as e:
        logger.warning(f"[Extractor:SuperEmbed] Error: {e}")
    return None


async def extract_embedsu(tmdb_id: str, media_type: str = 'movie', season: int = None, episode: int = None) -> Optional[Dict]:
    """Extract video URL from Embed.su"""
    try:
        if media_type == 'movie':
            embed_url = f'https://embed.su/embed/movie/{tmdb_id}'
        else:
            embed_url = f'https://embed.su/embed/tv/{tmdb_id}/{season}/{episode}'
        
        video = await extract_video_from_page(embed_url, 'https://embed.su/')
        if video:
            return {'url': video, 'source': 'Embed.su', 'referer': 'https://embed.su/'}
    except Exception as e:
        logger.warning(f"[Extractor:Embed.su] Error: {e}")
    return None


async def extract_smashystream(tmdb_id: str, media_type: str = 'movie', season: int = None, episode: int = None) -> Optional[Dict]:
    """Extract video URL from SmashyStream"""
    try:
        if media_type == 'movie':
            embed_url = f'https://player.smashy.stream/movie/{tmdb_id}'
        else:
            embed_url = f'https://player.smashy.stream/tv/{tmdb_id}/{season}/{episode}'
        
        video = await extract_video_from_page(embed_url, 'https://player.smashy.stream/')
        if video:
            return {'url': video, 'source': 'SmashyStream', 'referer': 'https://player.smashy.stream/'}
    except Exception as e:
        logger.warning(f"[Extractor:SmashyStream] Error: {e}")
    return None


# Ordered list of extractors — tried in priority order
EXTRACTORS = [
    ('VidSrc', extract_vidsrc),
    ('VidSrc Pro', extract_vidsrc_pro),
    ('Videasy', extract_videasy),
    ('AutoEmbed', extract_autoembed),
    ('SuperEmbed', extract_superembed),
    ('Embed.su', extract_embedsu),
    ('SmashyStream', extract_smashystream),
]


async def extract_all(
    tmdb_id: str,
    media_type: str = 'movie',
    imdb_id: str = None,
    season: int = None,
    episode: int = None
) -> List[Dict]:
    """Try all extractors and return all found video URLs."""
    results = []
    
    for name, extractor in EXTRACTORS:
        try:
            if name == 'SuperEmbed':
                result = await extractor(tmdb_id, imdb_id, media_type, season, episode)
            else:
                result = await extractor(tmdb_id, media_type, season, episode)
            
            if result:
                results.append(result)
                logger.info(f"[Extractor] SUCCESS: {name} -> {result['url'][:80]}...")
        except Exception as e:
            logger.warning(f"[Extractor] {name} failed: {e}")
            continue
    
    logger.info(f"[Extractor] Found {len(results)} direct streams for {media_type}/{tmdb_id}")
    return results


async def extract_best(
    tmdb_id: str,
    media_type: str = 'movie',
    imdb_id: str = None,
    season: int = None,
    episode: int = None
) -> Optional[Dict]:
    """Try extractors in order and return the FIRST successful result."""
    for name, extractor in EXTRACTORS:
        try:
            if name == 'SuperEmbed':
                result = await extractor(tmdb_id, imdb_id, media_type, season, episode)
            else:
                result = await extractor(tmdb_id, media_type, season, episode)
            
            if result:
                logger.info(f"[Extractor] Best found via {name}: {result['url'][:80]}...")
                return result
        except Exception as e:
            logger.warning(f"[Extractor] {name} failed: {e}")
            continue
    
    return None
