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
