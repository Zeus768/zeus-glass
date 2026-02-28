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
    """Search for movie torrents"""
    try:
        results = TorrentScraper.search_movie(title, year)
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
