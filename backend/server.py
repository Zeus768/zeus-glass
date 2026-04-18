from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from torrent_scraper import TorrentScraper
from torrentio_indexer import TorrentioIndexer, RealDebridIntegration
from smart_scraper import SmartScraper
import httpx

# Constants for Debrid services
REAL_DEBRID_CLIENT_ID = 'X245A4XAIBGVM'
ALLDEBRID_AGENT = 'zeus-glass'
from debrid_cache_search import RealDebridCacheSearch, AllDebridCacheSearch, PremiumizeCacheSearch


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Torrent scraping endpoints
@api_router.get("/torrents/search")
async def search_torrents(query: str, limit: int = 10):
    """Search for torrents across multiple sources"""
    try:
        results = TorrentScraper.search_all(query, limit_per_source=limit)
        return {"success": True, "count": len(results), "results": results}
    except Exception as e:
        logger.error(f"Error searching torrents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/torrents/movie")
async def search_movie_torrents(title: str, year: Optional[int] = None):
    """Search for movie torrents - Smart scraper with common patterns"""
    try:
        # Use smart scraper that generates intelligent queries
        results = SmartScraper.create_mock_results_from_patterns(
            SmartScraper.generate_movie_queries(title, year if year else 2024)
        )
        return {"success": True, "count": len(results), "results": results}
    except Exception as e:
        logger.error(f"Error searching movie torrents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/torrents/tv")
async def search_tv_torrents(
    title: str, 
    season: Optional[int] = None, 
    episode: Optional[int] = None
):
    """Search for TV show torrents"""
    try:
        results = TorrentScraper.search_tv_show(title, season, episode)
        return {"success": True, "count": len(results), "results": results}
    except Exception as e:
        logger.error(f"Error searching TV torrents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Torrentio endpoints (better indexer, no VPN needed)
@api_router.get("/torrents/torrentio/movie")
async def torrentio_movie(imdb_id: str = None, title: str = None, year: int = None):
    """Search for movie via Torrentio indexer"""
    try:
        results = TorrentioIndexer.search_movie(imdb_id=imdb_id, title=title, year=year)
        return {"success": True, "count": len(results), "results": results, "source": "Torrentio"}
    except Exception as e:
        logger.error(f"Error searching Torrentio movie: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/torrents/torrentio/tv")
async def torrentio_tv(imdb_id: str = None, title: str = None, season: int = 1, episode: int = 1):
    """Search for TV show via Torrentio indexer"""
    try:
        results = TorrentioIndexer.search_tv(imdb_id=imdb_id, title=title, season=season, episode=episode)
        return {"success": True, "count": len(results), "results": results, "source": "Torrentio"}
    except Exception as e:
        logger.error(f"Error searching Torrentio TV: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Real-Debrid full integration
@api_router.post("/debrid/real-debrid/add-magnet")
async def rd_add_magnet(magnet: str, token: str):
    """Add magnet to Real-Debrid"""
    try:
        result = RealDebridIntegration.add_magnet(magnet, token)
        if result:
            return {"success": True, "data": result}
        else:
            raise HTTPException(status_code=400, detail="Failed to add magnet")
    except Exception as e:
        logger.error(f"Error adding magnet to RD: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/debrid/real-debrid/select-files")
async def rd_select_files(torrent_id: str, file_ids: str, token: str):
    """Select files from Real-Debrid torrent"""
    try:
        success = RealDebridIntegration.select_files(torrent_id, file_ids, token)
        return {"success": success}
    except Exception as e:
        logger.error(f"Error selecting files: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/debrid/real-debrid/torrent-info")
async def rd_torrent_info(torrent_id: str, token: str):
    """Get torrent info from Real-Debrid"""
    try:
        info = RealDebridIntegration.get_torrent_info(torrent_id, token)
        if info:
            return {"success": True, "data": info}
        else:
            raise HTTPException(status_code=404, detail="Torrent not found")
    except Exception as e:
        logger.error(f"Error getting torrent info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/debrid/real-debrid/unrestrict")
async def rd_unrestrict(link: str, token: str):
    """Unrestrict a link via Real-Debrid"""
    try:
        result = RealDebridIntegration.unrestrict_link(link, token)
        if result:
            return {"success": True, "data": result}
        else:
            raise HTTPException(status_code=400, detail="Failed to unrestrict")
    except Exception as e:
        logger.error(f"Error unrestricting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/debrid/real-debrid/torrents")
async def rd_get_torrents(token: str):
    """Get all user torrents from Real-Debrid"""
    try:
        torrents = RealDebridIntegration.get_all_torrents(token)
        return {"success": True, "count": len(torrents), "torrents": torrents}
    except Exception as e:
        logger.error(f"Error getting torrents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# DEBRID CACHE SEARCH - Main Streaming Feature
# ============================================

@api_router.get("/debrid/cache/search/movie")
async def search_cached_movie(
    title: str,
    token: str,
    year: Optional[int] = None,
    imdb_id: Optional[str] = None
):
    """
    Search for cached movie torrents on Real-Debrid
    This is the main endpoint for finding instant-play movies
    """
    try:
        logger.info(f"Searching cached movie: title={title}, year={year}, imdb_id={imdb_id}")
        results = RealDebridCacheSearch.search_cached_torrents(
            query=title,
            token=token,
            content_type="movie",
            year=year,
            imdb_id=imdb_id  # Pass IMDB ID for better indexer results
        )
        logger.info(f"Found {len(results)} cached results")
        return {
            "success": True,
            "count": len(results),
            "results": results,
            "source": "Real-Debrid Cache"
        }
    except Exception as e:
        logger.error(f"Error searching cached movie: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/debrid/cache/search/tv")
async def search_cached_tv(
    title: str,
    token: str,
    season: int = 1,
    episode: int = 1,
    imdb_id: Optional[str] = None
):
    """
    Search for cached TV show torrents on Real-Debrid
    """
    try:
        results = RealDebridCacheSearch.search_cached_torrents(
            query=title,
            token=token,
            content_type="tv",
            season=season,
            episode=episode
        )
        return {
            "success": True,
            "count": len(results),
            "results": results,
            "source": "Real-Debrid Cache"
        }
    except Exception as e:
        logger.error(f"Error searching cached TV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/debrid/cache/stream")
async def get_stream_link(
    hash: str,
    token: str,
    file_id: Optional[str] = None
):
    """
    Get direct stream link for a cached torrent
    This adds the torrent to RD and returns the streaming URL
    """
    try:
        stream_url = RealDebridCacheSearch.add_and_get_stream_link(
            info_hash=hash,
            token=token,
            file_id=file_id
        )
        
        if stream_url:
            return {
                "success": True,
                "stream_url": stream_url
            }
        else:
            raise HTTPException(status_code=404, detail="Could not get stream link")
    except Exception as e:
        logger.error(f"Error getting stream link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/debrid/alldebrid/cache/check")
async def check_alldebrid_cache(hashes: str, apikey: str):
    """Check which torrents are cached on AllDebrid"""
    try:
        hash_list = hashes.split(',')
        cached = AllDebridCacheSearch.check_instant_availability(hash_list, apikey)
        return {"success": True, "cached": cached}
    except Exception as e:
        logger.error(f"Error checking AllDebrid cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/debrid/premiumize/cache/check")
async def check_premiumize_cache(hashes: str, apikey: str):
    """Check which torrents are cached on Premiumize"""
    try:
        hash_list = hashes.split(',')
        cached = PremiumizeCacheSearch.check_instant_availability(hash_list, apikey)
        return {"success": True, "cached": cached}
    except Exception as e:
        logger.error(f"Error checking Premiumize cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# DEBRID AUTHENTICATION PROXY ENDPOINTS
# These endpoints proxy Debrid auth requests to avoid CORS issues on web
# ============================================

@api_router.get("/debrid/real-debrid/device-code")
async def get_real_debrid_device_code():
    """Get Real-Debrid device code for OAuth flow"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.real-debrid.com/oauth/v2/device/code",
                params={
                    "client_id": REAL_DEBRID_CLIENT_ID,
                    "new_credentials": "yes"
                },
                timeout=15.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Real-Debrid device code error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/debrid/real-debrid/credentials")
async def poll_real_debrid_credentials(code: str):
    """Poll for Real-Debrid credentials after user authorization"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.real-debrid.com/oauth/v2/device/credentials",
                params={
                    "client_id": REAL_DEBRID_CLIENT_ID,
                    "code": code
                },
                timeout=15.0
            )
            # Return the response even if it's an error (user not authorized yet)
            return {"status_code": response.status_code, "data": response.json() if response.status_code == 200 else None}
    except httpx.HTTPStatusError as e:
        return {"status_code": e.response.status_code, "data": None}
    except Exception as e:
        logger.error(f"Real-Debrid credentials error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/debrid/real-debrid/token")
async def get_real_debrid_token(client_id: str, client_secret: str, code: str):
    """Exchange credentials for Real-Debrid access token"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.real-debrid.com/oauth/v2/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "http://oauth.net/grant_type/device/1.0"
                },
                timeout=15.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Real-Debrid token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/debrid/alldebrid/pin")
async def get_alldebrid_pin():
    """Get AllDebrid PIN for authentication"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.alldebrid.com/v4/pin/get",
                params={"agent": ALLDEBRID_AGENT},
                timeout=15.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"AllDebrid PIN error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/debrid/alldebrid/pin-check")
async def check_alldebrid_pin(pin: str):
    """Check AllDebrid PIN status"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.alldebrid.com/v4/pin/check",
                params={"agent": ALLDEBRID_AGENT, "pin": pin},
                timeout=15.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"AllDebrid PIN check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/debrid/premiumize/account-info")
async def get_premiumize_account_info(apikey: str):
    """Get Premiumize account info to verify API key"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.premiumize.me/api/account/info",
                params={"apikey": apikey},
                timeout=15.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Premiumize account info error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# TORBOX PROXY - Device Code Flow
# ============================================

@api_router.post("/debrid/torbox/device-start")
async def torbox_device_start():
    """Start TorBox device code auth flow"""
    try:
        async with httpx.AsyncClient() as client:
            # TorBox uses GET for device code start
            response = await client.get(
                "https://api.torbox.app/v1/api/user/auth/device/start",
                timeout=15.0
            )
            response.raise_for_status()
            data = response.json()
            
            # Transform TorBox response to standard format
            if data.get('success') and data.get('data'):
                inner = data['data']
                return {
                    'data': {
                        'device_code': inner.get('device_code'),
                        'user_code': inner.get('code'),  # TorBox uses 'code' not 'user_code'
                        'verification_url': inner.get('verification_url') or inner.get('friendly_verification_url'),
                        'expires_in': 600,  # Default 10 minutes
                        'interval': inner.get('interval', 5),
                    }
                }
            return data
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"TorBox device start error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/debrid/torbox/device-token")
async def torbox_device_token(device_code: str):
    """Poll for TorBox device token"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.torbox.app/v1/api/user/auth/device/token",
                json={"device_code": device_code},
                timeout=15.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        # 400 means still waiting - not an error
        if e.response.status_code == 400:
            return {"status": "pending"}
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"TorBox device token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/debrid/torbox/account-info")
async def torbox_account_info(token: str):
    """Get TorBox account info"""
    try:
        # Handle empty token gracefully
        if not token or not token.strip():
            raise HTTPException(status_code=400, detail="Token is required")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.torbox.app/v1/api/user/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TorBox account info error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# TORRENTIO PROXY - Bypass CORS for web clients
# ============================================

@api_router.get("/torrentio/stream/{content_type}/{content_id:path}")
async def proxy_torrentio_stream(content_type: str, content_id: str):
    """Proxy Torrentio stream requests to bypass CORS"""
    try:
        url = f"https://torrentio.strem.fun/stream/{content_type}/{content_id}"
        if not url.endswith('.json'):
            url += '.json'
        
        logger.info(f"Proxying Torrentio request: {url}")
        
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
                },
                timeout=20.0
            )
            response.raise_for_status()
            data = response.json()
            streams = data.get('streams', [])
            logger.info(f"Torrentio returned {len(streams)} streams")
            return {"streams": streams}
    except httpx.HTTPStatusError as e:
        logger.error(f"Torrentio proxy HTTP error: {e.response.status_code}")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Torrentio proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/torrentio/catalog/{catalog_type}/{catalog_id}")
async def proxy_torrentio_catalog(catalog_type: str, catalog_id: str):
    """Proxy Torrentio catalog requests"""
    try:
        url = f"https://torrentio.strem.fun/catalog/{catalog_type}/{catalog_id}.json"
        logger.info(f"Proxying Torrentio catalog: {url}")
        
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(url, timeout=15.0)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Torrentio catalog proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# TRAKT AUTH PROXY - For environments with CORS issues
# ============================================

@api_router.post("/trakt/device/code")
async def trakt_device_code():
    """Get Trakt device code for OAuth flow"""
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                "https://api.trakt.tv/oauth/device/code",
                json={"client_id": "4cb0f37f73fc75a20dee4176591d04845a4f942cb386a7e9e33a2e9fb480593e"},
                headers={
                    "Content-Type": "application/json",
                    "trakt-api-version": "2",
                    "trakt-api-key": "4cb0f37f73fc75a20dee4176591d04845a4f942cb386a7e9e33a2e9fb480593e",
                },
                timeout=15.0
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Trakt device code error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/trakt/device/token")
async def trakt_device_token(code: str, client_id: str, client_secret: str):
    """Poll for Trakt token after user authorization"""
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                "https://api.trakt.tv/oauth/device/token",
                json={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                headers={
                    "Content-Type": "application/json",
                    "trakt-api-version": "2",
                    "trakt-api-key": client_id,
                },
                timeout=15.0
            )
            if response.status_code == 400:
                return {"status_code": 400, "data": None}
            response.raise_for_status()
            return {"status_code": 200, "data": response.json()}
    except httpx.HTTPStatusError as e:
        return {"status_code": e.response.status_code, "data": None}
    except Exception as e:
        logger.error(f"Trakt device token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# STREAMING PROXY ENDPOINT
# Routes streaming requests through a configured proxy server
# ============================================
class ProxyFetchRequest(BaseModel):
    url: str
    proxy_url: str
    method: str = "GET"
    headers: Optional[dict] = None

@api_router.post("/proxy/fetch")
async def proxy_fetch(request: ProxyFetchRequest):
    """Fetch a URL through a proxy server for geo-unblocking"""
    try:
        proxies = request.proxy_url
        async with httpx.AsyncClient(proxy=proxies, timeout=30.0, follow_redirects=True) as client_proxy:
            if request.method.upper() == "GET":
                response = await client_proxy.get(
                    request.url,
                    headers=request.headers or {}
                )
            else:
                response = await client_proxy.post(
                    request.url,
                    headers=request.headers or {}
                )
            
            return {
                "status_code": response.status_code,
                "data": response.text,
                "headers": dict(response.headers),
            }
    except Exception as e:
        logger.error(f"Proxy fetch error: {e}")
        raise HTTPException(status_code=502, detail=f"Proxy request failed: {str(e)}")

@api_router.get("/proxy/test")
async def proxy_test(proxy_url: str):
    """Test if a proxy server is reachable"""
    try:
        async with httpx.AsyncClient(proxy=proxy_url, timeout=10.0) as client_proxy:
            response = await client_proxy.get("https://httpbin.org/ip")
            return {
                "success": True,
                "ip": response.json().get("origin", "unknown"),
                "latency_ms": int(response.elapsed.total_seconds() * 1000),
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================
# ERROR LOG UPLOAD & DASHBOARD
# Stores device logs in MongoDB for remote debugging
# ============================================
class LogEntryModel(BaseModel):
    id: str
    timestamp: str
    level: str
    message: str
    context: Optional[str] = None
    stack: Optional[str] = None
    deviceInfo: Optional[dict] = None

class LogUploadRequest(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    platform: Optional[str] = None
    app_version: Optional[str] = None
    logs: List[LogEntryModel]

@api_router.post("/logs/upload")
async def upload_logs(request: LogUploadRequest):
    """Upload device logs to the cloud for remote debugging"""
    try:
        doc = {
            "device_id": request.device_id,
            "device_name": request.device_name or "Unknown",
            "platform": request.platform or "unknown",
            "app_version": request.app_version or "unknown",
            "uploaded_at": datetime.utcnow().isoformat(),
            "log_count": len(request.logs),
            "logs": [l.dict() for l in request.logs],
        }
        await db.error_logs.insert_one(doc)
        return {"success": True, "message": f"Uploaded {len(request.logs)} logs", "log_count": len(request.logs)}
    except Exception as e:
        logger.error(f"Log upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/logs")
async def get_logs(limit: int = 20, device_id: Optional[str] = None, level: Optional[str] = None):
    """Retrieve uploaded logs from all devices"""
    try:
        query = {}
        if device_id:
            query["device_id"] = device_id
        
        uploads = await db.error_logs.find(query, {"_id": 0}).sort("uploaded_at", -1).to_list(limit)
        
        # If filtering by level, filter the individual log entries
        if level:
            for upload in uploads:
                upload["logs"] = [l for l in upload["logs"] if l["level"] == level]
                upload["log_count"] = len(upload["logs"])
        
        total = await db.error_logs.count_documents(query)
        return {"success": True, "total": total, "showing": len(uploads), "uploads": uploads}
    except Exception as e:
        logger.error(f"Log retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/logs/clear")
async def clear_logs():
    """Clear all stored logs"""
    try:
        result = await db.error_logs.delete_many({})
        return {"success": True, "deleted": result.deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import HTMLResponse

@api_router.get("/logs/dashboard", response_class=HTMLResponse)
async def logs_dashboard():
    """Web dashboard to view all uploaded error logs"""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Zeus Glass - Error Log Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0e17;color:#e0e6ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px}
h1{color:#00d4ff;font-size:24px}
.controls{display:flex;gap:8px;flex-wrap:wrap}
.btn{padding:8px 16px;border-radius:8px;border:1px solid #1a2235;background:#111827;color:#e0e6ed;cursor:pointer;font-size:13px;transition:all .2s}
.btn:hover{background:#1e293b;border-color:#00d4ff}
.btn.danger{border-color:#ef4444;color:#ef4444}
.btn.danger:hover{background:#7f1d1d}
.filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
select,input{padding:8px 12px;border-radius:8px;border:1px solid #1a2235;background:#111827;color:#e0e6ed;font-size:13px}
.upload-card{background:#111827;border:1px solid #1a2235;border-radius:12px;margin-bottom:16px;overflow:hidden}
.upload-header{padding:14px 18px;background:#0d1321;border-bottom:1px solid #1a2235;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.device-name{font-weight:600;color:#00d4ff;font-size:15px}
.upload-meta{font-size:12px;color:#6b7280;display:flex;gap:12px;flex-wrap:wrap}
.upload-meta span{display:flex;align-items:center;gap:4px}
.badge{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.badge.error{background:#7f1d1d;color:#fca5a5}
.badge.warn{background:#78350f;color:#fcd34d}
.badge.info{background:#1e3a5f;color:#93c5fd}
.badge.debug{background:#1a2235;color:#9ca3af}
.log-entry{padding:10px 18px;border-bottom:1px solid #0d1321;font-size:13px;display:grid;grid-template-columns:70px 90px 1fr;gap:8px;align-items:start}
.log-entry:hover{background:#0d1321}
.log-time{color:#6b7280;font-size:11px;font-family:monospace}
.log-context{color:#8b5cf6;font-size:12px}
.log-message{color:#e0e6ed;word-break:break-word}
.log-stack{color:#9ca3af;font-size:11px;font-family:monospace;white-space:pre-wrap;margin-top:4px;max-height:120px;overflow-y:auto;background:#0a0e17;padding:6px;border-radius:4px}
.empty{text-align:center;padding:60px;color:#6b7280}
.stats{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.stat{background:#111827;border:1px solid #1a2235;border-radius:10px;padding:14px 20px;min-width:140px}
.stat-value{font-size:28px;font-weight:700;color:#00d4ff}
.stat-label{font-size:12px;color:#6b7280;margin-top:2px}
.stat.errors .stat-value{color:#ef4444}
.loading{text-align:center;padding:40px;color:#6b7280}
.toggle-stack{cursor:pointer;color:#00d4ff;font-size:11px;margin-top:4px}
</style>
</head>
<body>
<div class="header">
  <h1>Zeus Glass Log Dashboard</h1>
  <div class="controls">
    <button class="btn" onclick="loadLogs()">Refresh</button>
    <button class="btn" onclick="exportLogs()">Export JSON</button>
    <button class="btn danger" onclick="clearAll()">Clear All</button>
  </div>
</div>
<div class="stats" id="stats"></div>
<div class="filters">
  <select id="levelFilter" onchange="loadLogs()">
    <option value="">All Levels</option>
    <option value="error">Errors Only</option>
    <option value="warn">Warnings</option>
    <option value="info">Info</option>
    <option value="debug">Debug</option>
  </select>
  <select id="limitFilter" onchange="loadLogs()">
    <option value="20">Last 20 uploads</option>
    <option value="50">Last 50</option>
    <option value="100">Last 100</option>
  </select>
  <input type="text" id="searchFilter" placeholder="Search messages..." oninput="filterLocally()">
</div>
<div id="content"><div class="loading">Loading logs...</div></div>

<script>
document.addEventListener('DOMContentLoaded', function() {
let allData = [];
const API = window.location.origin + '/api';

window.loadLogs = async function() {
  const level = document.getElementById('levelFilter').value;
  const limit = document.getElementById('limitFilter').value;
  let url = API + '/logs?limit=' + limit;
  if (level) url += '&level=' + level;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    allData = data.uploads || [];
    renderStats(data);
    renderLogs(allData);
  } catch(e) {
    document.getElementById('content').innerHTML = '<div class="empty">Failed to load logs: ' + e.message + '</div>';
  }
}

window.renderStats = function(data) {
  let totalErrors = 0, totalWarns = 0, totalLogs = 0, devices = new Set();
  allData.forEach(u => {
    devices.add(u.device_id);
    u.logs.forEach(l => {
      totalLogs++;
      if(l.level === 'error') totalErrors++;
      if(l.level === 'warn') totalWarns++;
    });
  });
  document.getElementById('stats').innerHTML =
    '<div class="stat"><div class="stat-value">' + data.total + '</div><div class="stat-label">Total Uploads</div></div>' +
    '<div class="stat"><div class="stat-value">' + devices.size + '</div><div class="stat-label">Devices</div></div>' +
    '<div class="stat errors"><div class="stat-value">' + totalErrors + '</div><div class="stat-label">Errors</div></div>' +
    '<div class="stat"><div class="stat-value">' + totalWarns + '</div><div class="stat-label">Warnings</div></div>' +
    '<div class="stat"><div class="stat-value">' + totalLogs + '</div><div class="stat-label">Total Entries</div></div>';
}

window.renderLogs = function(uploads) {
  if(!uploads.length) {
    document.getElementById('content').innerHTML = '<div class="empty">No logs uploaded yet. Logs will appear here when devices upload them.</div>';
    return;
  }
  let html = '';
  uploads.forEach(u => {
    const time = new Date(u.uploaded_at).toLocaleString();
    html += '<div class="upload-card">';
    html += '<div class="upload-header"><div><span class="device-name">' + (u.device_name || u.device_id) + '</span></div>';
    html += '<div class="upload-meta"><span>' + time + '</span><span>' + u.platform + '</span><span>v' + u.app_version + '</span><span>' + u.log_count + ' entries</span></div></div>';
    u.logs.forEach((l, i) => {
      const t = new Date(l.timestamp).toLocaleTimeString();
      html += '<div class="log-entry"><span class="badge ' + l.level + '">' + l.level.toUpperCase() + '</span>';
      html += '<span class="log-context">' + (l.context || '-') + '</span>';
      html += '<div><span class="log-message">' + escapeHtml(l.message) + '</span>';
      if(l.stack) html += '<div class="toggle-stack" onclick="var s=this.nextSibling;s.style.display=s.style.display===String.fromCharCode(110,111,110,101)?String.fromCharCode(98,108,111,99,107):String.fromCharCode(110,111,110,101)">Show Stack</div><div class="log-stack" style="display:none">' + escapeHtml(l.stack) + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
  });
  document.getElementById('content').innerHTML = html;
}

window.filterLocally = function() {
  const q = document.getElementById('searchFilter').value.toLowerCase();
  if(!q) { renderLogs(allData); return; }
  const filtered = allData.map(u => ({
    ...u,
    logs: u.logs.filter(l => l.message.toLowerCase().includes(q) || (l.context||'').toLowerCase().includes(q)),
    log_count: undefined
  })).map(u => ({...u, log_count: u.logs.length})).filter(u => u.logs.length > 0);
  renderLogs(filtered);
}

function escapeHtml(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; }

window.clearAll = async function() {
  if(!confirm('Delete ALL stored logs? This cannot be undone.')) return;
  await fetch(API + '/logs/clear', {method:'DELETE'});
  loadLogs();
}

window.exportLogs = function() {
  const blob = new Blob([JSON.stringify(allData, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zeus-glass-logs-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

loadLogs();
});
</script>
</body>
</html>"""
    return HTMLResponse(content=html)


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
