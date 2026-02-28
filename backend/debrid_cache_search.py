"""
Real-Debrid Cache Search Service
Searches for instantly available (cached) torrents on Real-Debrid
This bypasses the need to scrape torrent sites directly
"""

import requests
import logging
import re
import hashlib
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)


class RealDebridCacheSearch:
    """
    Real-Debrid Cache Search
    Uses the Real-Debrid API to find cached torrents
    """
    
    BASE_URL = "https://api.real-debrid.com/rest/1.0"
    
    # Known torrent hash databases (public APIs that return hashes)
    HASH_SOURCES = [
        # BTDigg API format
        "https://btdig.com/search?q={query}&order=0",
        # solidtorrents
        "https://solidtorrents.to/api/v1/search?q={query}",
    ]
    
    @staticmethod
    def search_cached_torrents(
        query: str,
        token: str,
        content_type: str = "movie",
        year: Optional[int] = None,
        season: Optional[int] = None,
        episode: Optional[int] = None
    ) -> List[Dict]:
        """
        Main search function - finds cached torrents on Real-Debrid
        
        Flow:
        1. Get torrent hashes from multiple sources
        2. Check which ones are cached on Real-Debrid
        3. Return cached torrents with quality info
        """
        results = []
        
        try:
            # Build search query
            search_query = RealDebridCacheSearch._build_query(
                query, content_type, year, season, episode
            )
            
            # Get hashes from Torrentio first (most reliable)
            hashes = RealDebridCacheSearch._get_hashes_from_torrentio(
                query, content_type, year, season, episode
            )
            
            if not hashes:
                logger.warning(f"No hashes found for query: {search_query}")
                return []
            
            # Check cache availability on Real-Debrid
            cached_info = RealDebridCacheSearch._check_instant_availability(
                list(hashes.keys()), token
            )
            
            # Process cached results
            for info_hash, cache_data in cached_info.items():
                if info_hash in hashes:
                    torrent_info = hashes[info_hash]
                    
                    # Get the best file from cache
                    best_file = RealDebridCacheSearch._get_best_file(cache_data)
                    if best_file:
                        result = {
                            'hash': info_hash,
                            'title': torrent_info.get('title', query),
                            'quality': torrent_info.get('quality', '720p'),
                            'size': torrent_info.get('size', 'Unknown'),
                            'seeders': torrent_info.get('seeders', 0),
                            'source': torrent_info.get('source', 'Real-Debrid Cache'),
                            'cached': True,
                            'file_id': best_file.get('id'),
                            'filename': best_file.get('filename', ''),
                            'filesize': best_file.get('filesize', 0),
                            'magnet': f"magnet:?xt=urn:btih:{info_hash}",
                        }
                        results.append(result)
            
            # Sort by quality
            results = RealDebridCacheSearch._sort_by_quality(results)
            
        except Exception as e:
            logger.error(f"Error in cache search: {e}")
        
        return results
    
    @staticmethod
    def _build_query(
        query: str,
        content_type: str,
        year: Optional[int] = None,
        season: Optional[int] = None,
        episode: Optional[int] = None
    ) -> str:
        """Build a search query string"""
        search_query = query
        
        if year and content_type == "movie":
            search_query += f" {year}"
        
        if content_type == "tv" and season is not None:
            search_query += f" S{season:02d}"
            if episode is not None:
                search_query += f"E{episode:02d}"
        
        return search_query
    
    @staticmethod
    def _get_hashes_from_torrentio(
        query: str,
        content_type: str = "movie",
        year: Optional[int] = None,
        season: Optional[int] = None,
        episode: Optional[int] = None,
        imdb_id: Optional[str] = None
    ) -> Dict[str, Dict]:
        """
        Get torrent hashes from Torrentio (Stremio's torrent aggregator)
        Returns dict of hash -> torrent info
        """
        hashes = {}
        
        try:
            # Torrentio works best with IMDB IDs
            if content_type == "movie":
                if imdb_id:
                    url = f"https://torrentio.strem.fun/stream/movie/{imdb_id}.json"
                else:
                    # Try with query + year format
                    url = f"https://torrentio.strem.fun/stream/movie/{query}:{year or 2024}.json"
            else:
                # TV show
                s = season or 1
                e = episode or 1
                if imdb_id:
                    url = f"https://torrentio.strem.fun/stream/series/{imdb_id}:{s}:{e}.json"
                else:
                    url = f"https://torrentio.strem.fun/stream/series/{query}:{s}:{e}.json"
            
            response = requests.get(url, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                streams = data.get('streams', [])
                
                for stream in streams:
                    info_hash = stream.get('infoHash', '').lower()
                    title = stream.get('title', '')
                    
                    if info_hash and len(info_hash) == 40:
                        hashes[info_hash] = {
                            'title': title,
                            'quality': RealDebridCacheSearch._extract_quality(title),
                            'size': RealDebridCacheSearch._extract_size(title),
                            'seeders': RealDebridCacheSearch._extract_seeders(title),
                            'source': RealDebridCacheSearch._extract_source(title),
                        }
            
        except Exception as e:
            logger.error(f"Error fetching from Torrentio: {e}")
        
        return hashes
    
    @staticmethod
    def _check_instant_availability(hashes: List[str], token: str) -> Dict[str, Dict]:
        """
        Check which torrents are instantly available (cached) on Real-Debrid
        Returns dict of hash -> cache info
        """
        cached = {}
        
        if not hashes:
            return cached
        
        try:
            # Real-Debrid allows checking multiple hashes at once
            # Join hashes with /
            hash_string = "/".join(hashes[:100])  # Limit to 100
            
            url = f"{RealDebridCacheSearch.BASE_URL}/torrents/instantAvailability/{hash_string}"
            headers = {"Authorization": f"Bearer {token}"}
            
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                # Real-Debrid returns nested structure
                for info_hash, availability in data.items():
                    if availability and isinstance(availability, dict):
                        # Check if there are cached files
                        rd_data = availability.get('rd', [])
                        if rd_data and len(rd_data) > 0:
                            # Take the first available variant
                            cached[info_hash.lower()] = rd_data[0]
            
        except Exception as e:
            logger.error(f"Error checking instant availability: {e}")
        
        return cached
    
    @staticmethod
    def _get_best_file(cache_data: Dict) -> Optional[Dict]:
        """
        Get the best video file from cached torrent data
        Prefers largest video file (usually the main content)
        """
        best_file = None
        best_size = 0
        
        video_extensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v']
        
        try:
            for file_id, file_info in cache_data.items():
                filename = file_info.get('filename', '').lower()
                filesize = file_info.get('filesize', 0)
                
                # Check if it's a video file
                is_video = any(filename.endswith(ext) for ext in video_extensions)
                
                if is_video and filesize > best_size:
                    best_size = filesize
                    best_file = {
                        'id': file_id,
                        'filename': file_info.get('filename'),
                        'filesize': filesize,
                    }
        except Exception as e:
            logger.error(f"Error getting best file: {e}")
        
        return best_file
    
    @staticmethod
    def _extract_quality(title: str) -> str:
        """Extract quality from title"""
        title_upper = title.upper()
        
        if '4K' in title_upper or '2160P' in title_upper or 'UHD' in title_upper:
            return '4K'
        elif '1080P' in title_upper:
            return '1080p'
        elif '720P' in title_upper:
            return '720p'
        elif '480P' in title_upper:
            return '480p'
        
        return '720p'  # Default
    
    @staticmethod
    def _extract_size(title: str) -> str:
        """Extract file size from title"""
        # Torrentio format: "💾 2.1 GB"
        size_match = re.search(r'💾\s*([\d.]+\s*[GMK]?B)', title)
        if size_match:
            return size_match.group(1)
        
        # Alternative format
        size_match = re.search(r'([\d.]+\s*[GMK]B)', title, re.IGNORECASE)
        if size_match:
            return size_match.group(1)
        
        return "Unknown"
    
    @staticmethod
    def _extract_seeders(title: str) -> int:
        """Extract seeders count from title"""
        # Torrentio format: "👤 150"
        seeders_match = re.search(r'👤\s*(\d+)', title)
        if seeders_match:
            return int(seeders_match.group(1))
        
        return 0
    
    @staticmethod
    def _extract_source(title: str) -> str:
        """Extract source/tracker from title"""
        sources = ['YTS', 'EZTV', 'RARBG', '1337X', 'TPB', 'THEPIRATEBAY', 'RUTOR', 'NYAA']
        
        title_upper = title.upper()
        for source in sources:
            if source in title_upper:
                return source
        
        # Check for quality groups
        groups = ['YIFY', 'SPARKS', 'GECKOS', 'AMIABLE', 'RARBG', 'FGT', 'EVO']
        for group in groups:
            if group in title_upper:
                return group
        
        return "Torrentio"
    
    @staticmethod
    def _sort_by_quality(results: List[Dict]) -> List[Dict]:
        """Sort results by quality (4K > 1080p > 720p > 480p)"""
        quality_order = {'4K': 0, '2160p': 0, '1080p': 1, '720p': 2, '480p': 3}
        
        return sorted(
            results,
            key=lambda x: quality_order.get(x.get('quality', '720p'), 999)
        )
    
    @staticmethod
    def add_and_get_stream_link(
        info_hash: str,
        token: str,
        file_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Add torrent to Real-Debrid and get direct stream link
        
        Flow:
        1. Add magnet to Real-Debrid
        2. Select files (or all)
        3. Wait for it to be ready
        4. Unrestrict the link
        5. Return direct download URL
        """
        try:
            headers = {"Authorization": f"Bearer {token}"}
            magnet = f"magnet:?xt=urn:btih:{info_hash}"
            
            # Step 1: Add magnet
            add_url = f"{RealDebridCacheSearch.BASE_URL}/torrents/addMagnet"
            add_response = requests.post(
                add_url,
                headers=headers,
                data={"magnet": magnet},
                timeout=10
            )
            
            if add_response.status_code != 201:
                logger.error(f"Failed to add magnet: {add_response.text}")
                return None
            
            torrent_id = add_response.json().get('id')
            
            # Step 2: Get torrent info to see files
            info_url = f"{RealDebridCacheSearch.BASE_URL}/torrents/info/{torrent_id}"
            info_response = requests.get(info_url, headers=headers, timeout=10)
            
            if info_response.status_code != 200:
                return None
            
            torrent_info = info_response.json()
            
            # Step 3: Select files
            if file_id:
                files_to_select = file_id
            else:
                # Select largest video file
                files = torrent_info.get('files', [])
                video_files = [
                    f for f in files 
                    if f.get('path', '').lower().endswith(('.mkv', '.mp4', '.avi'))
                ]
                if video_files:
                    largest = max(video_files, key=lambda x: x.get('bytes', 0))
                    files_to_select = str(largest.get('id', 1))
                else:
                    files_to_select = "all"
            
            select_url = f"{RealDebridCacheSearch.BASE_URL}/torrents/selectFiles/{torrent_id}"
            requests.post(
                select_url,
                headers=headers,
                data={"files": files_to_select},
                timeout=10
            )
            
            # Step 4: Wait for torrent to be ready (should be instant if cached)
            import time
            for _ in range(10):  # Max 10 seconds wait
                info_response = requests.get(info_url, headers=headers, timeout=10)
                if info_response.status_code == 200:
                    info = info_response.json()
                    status = info.get('status')
                    
                    if status == 'downloaded':
                        links = info.get('links', [])
                        if links:
                            # Step 5: Unrestrict the first link
                            unrestrict_url = f"{RealDebridCacheSearch.BASE_URL}/unrestrict/link"
                            unrestrict_response = requests.post(
                                unrestrict_url,
                                headers=headers,
                                data={"link": links[0]},
                                timeout=10
                            )
                            
                            if unrestrict_response.status_code == 200:
                                return unrestrict_response.json().get('download')
                        break
                    elif status in ['waiting_files_selection', 'queued', 'downloading']:
                        time.sleep(1)
                    else:
                        break
                else:
                    break
            
        except Exception as e:
            logger.error(f"Error getting stream link: {e}")
        
        return None


class AllDebridCacheSearch:
    """AllDebrid Cache Search (similar flow)"""
    
    BASE_URL = "https://api.alldebrid.com/v4"
    
    @staticmethod
    def check_instant_availability(hashes: List[str], apikey: str) -> Dict[str, bool]:
        """Check which torrents are cached on AllDebrid"""
        cached = {}
        
        try:
            # AllDebrid instant check
            magnets = [f"magnet:?xt=urn:btih:{h}" for h in hashes[:100]]
            
            url = f"{AllDebridCacheSearch.BASE_URL}/magnet/instant"
            params = {
                "agent": "zeus_glass",
                "apikey": apikey,
            }
            
            # AllDebrid accepts magnets as array
            for i, magnet in enumerate(magnets):
                params[f"magnets[{i}]"] = magnet
            
            response = requests.get(url, params=params, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    magnets_data = data.get('data', {}).get('magnets', [])
                    for magnet_info in magnets_data:
                        if magnet_info.get('instant'):
                            hash_value = magnet_info.get('hash', '').lower()
                            if hash_value:
                                cached[hash_value] = True
        
        except Exception as e:
            logger.error(f"Error checking AllDebrid availability: {e}")
        
        return cached


class PremiumizeCacheSearch:
    """Premiumize Cache Search"""
    
    BASE_URL = "https://www.premiumize.me/api"
    
    @staticmethod
    def check_instant_availability(hashes: List[str], apikey: str) -> Dict[str, bool]:
        """Check which torrents are cached on Premiumize"""
        cached = {}
        
        try:
            url = f"{PremiumizeCacheSearch.BASE_URL}/cache/check"
            params = {
                "apikey": apikey,
                "items[]": hashes[:100],
            }
            
            response = requests.get(url, params=params, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    results = data.get('response', [])
                    for i, is_cached in enumerate(results):
                        if i < len(hashes) and is_cached:
                            cached[hashes[i].lower()] = True
        
        except Exception as e:
            logger.error(f"Error checking Premiumize availability: {e}")
        
        return cached
