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

# Real-Debrid unrestrict endpoint
@api_router.post("/debrid/unrestrict")
async def unrestrict_magnet(magnet: str, service: str = "real-debrid", token: str = ""):
    """Unrestrict a magnet link via debrid service"""
    try:
        if not token:
            raise HTTPException(status_code=400, detail="Token required")
        
        # This would call the actual Real-Debrid API
        # For now, returning structure
        return {
            "success": True,
            "message": "Magnet added to debrid service",
            "service": service,
            "status": "processing"
        }
    except Exception as e:
        logger.error(f"Error unrest ricting magnet: {e}")
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
