import requests
import json
from typing import List, Dict, Optional
import logging
import re

logger = logging.getLogger(__name__)

class TorrentioIndexer:
    """
    Torrentio is a meta-search torrent indexer used by Stremio
    It aggregates results from YTS, EZTV, RARBG, 1337x, PirateBay, etc.
    Works without VPN and doesn't block requests
    """
    
    BASE_URL = "https://torrentio.strem.fun"
    
    @staticmethod
    def search_movie(imdb_id: str = None, title: str = None, year: int = None) -> List[Dict]:
        """
        Search for movie streams via Torrentio
        Returns list of torrent streams with quality, size, seeders
        """
        results = []
        
        try:
            # If we have IMDB ID, use it directly
            if imdb_id:
                stream_id = f"movie/{imdb_id}"
            elif title and year:
                # Try to find IMDB ID first (in production, you'd use TMDB/OMDB API)
                stream_id = f"movie/{title}:{year}"
            else:
                return results
            
            # Torrentio stream endpoint
            url = f"{TorrentioIndexer.BASE_URL}/stream/{stream_id}.json"
            
            response = requests.get(url, timeout=15)
            if response.status_code != 200:
                logger.warning(f"Torrentio returned status {response.status_code}")
                return results
            
            data = response.json()
            
            # Parse streams
            streams = data.get('streams', [])
            
            for stream in streams:
                try:
                    title_text = stream.get('title', '')
                    info_hash = stream.get('infoHash', '')
                    
                    # Extract quality, size, seeders from title
                    quality = TorrentioIndexer._extract_quality(title_text)
                    size = TorrentioIndexer._extract_size(title_text)
                    seeders = TorrentioIndexer._extract_seeders(title_text)
                    source = TorrentioIndexer._extract_source(title_text)
                    
                    # Build magnet link
                    magnet = f"magnet:?xt=urn:btih:{info_hash}"
                    
                    result = {
                        'title': title_text,
                        'magnet': magnet,
                        'info_hash': info_hash,
                        'quality': quality,
                        'size': size,
                        'seeders': seeders,
                        'source': source or 'Torrentio',
                        'raw_title': title_text
                    }
                    
                    results.append(result)
                    
                except Exception as e:
                    logger.error(f"Error parsing Torrentio stream: {e}")
                    continue
            
        except Exception as e:
            logger.error(f"Error fetching from Torrentio: {e}")
        
        return results
    
    @staticmethod
    def search_tv(imdb_id: str = None, title: str = None, season: int = 1, episode: int = 1) -> List[Dict]:
        """Search for TV show episodes via Torrentio"""
        results = []
        
        try:
            if imdb_id:
                stream_id = f"series/{imdb_id}:{season}:{episode}"
            elif title:
                stream_id = f"series/{title}:{season}:{episode}"
            else:
                return results
            
            url = f"{TorrentioIndexer.BASE_URL}/stream/{stream_id}.json"
            
            response = requests.get(url, timeout=15)
            if response.status_code != 200:
                return results
            
            data = response.json()
            streams = data.get('streams', [])
            
            for stream in streams:
                try:
                    title_text = stream.get('title', '')
                    info_hash = stream.get('infoHash', '')
                    
                    quality = TorrentioIndexer._extract_quality(title_text)
                    size = TorrentioIndexer._extract_size(title_text)
                    seeders = TorrentioIndexer._extract_seeders(title_text)
                    source = TorrentioIndexer._extract_source(title_text)
                    
                    magnet = f"magnet:?xt=urn:btih:{info_hash}"
                    
                    result = {
                        'title': title_text,
                        'magnet': magnet,
                        'info_hash': info_hash,
                        'quality': quality,
                        'size': size,
                        'seeders': seeders,
                        'source': source or 'Torrentio'
                    }
                    
                    results.append(result)
                    
                except Exception as e:
                    logger.error(f"Error parsing TV stream: {e}")
                    continue
            
        except Exception as e:
            logger.error(f"Error fetching TV from Torrentio: {e}")
        
        return results
    
    @staticmethod
    def _extract_quality(title: str) -> str:
        """Extract quality from title"""
        title_upper = title.upper()
        
        if '4K' in title_upper or '2160P' in title_upper or 'UHD' in title_upper:
            return '2160p'
        elif '1080P' in title_upper or 'FULLHD' in title_upper:
            return '1080p'
        elif '720P' in title_upper or 'HD' in title_upper:
            return '720p'
        elif '480P' in title_upper or 'HDTV' in title_upper:
            return '480p'
        
        return '720p'
    
    @staticmethod
    def _extract_size(title: str) -> str:
        """Extract file size from title"""
        # Torrentio format: "💾 2.1 GB"
        size_match = re.search(r'💾\s*([\d.]+\s*[GMK]B)', title)
        if size_match:
            return size_match.group(1)
        
        # Alternative format
        size_match = re.search(r'([\d.]+\s*[GMK]B)', title)
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
        
        # Alternative format
        seeders_match = re.search(r'(\d+)\s*seeders?', title, re.IGNORECASE)
        if seeders_match:
            return int(seeders_match.group(1))
        
        return 0
    
    @staticmethod
    def _extract_source(title: str) -> Optional[str]:
        """Extract source/tracker from title"""
        sources = ['YTS', 'EZTV', 'RARBG', '1337X', 'TPB', 'THEPIRATEBAY']
        
        title_upper = title.upper()
        for source in sources:
            if source in title_upper:
                return source
        
        return None


class RealDebridIntegration:
    """
    Full Real-Debrid integration for converting torrents to direct links
    """
    
    BASE_URL = "https://api.real-debrid.com/rest/1.0"
    
    @staticmethod
    def add_magnet(magnet: str, token: str) -> Optional[Dict]:
        """
        Add a magnet link to Real-Debrid
        Returns torrent ID if successful
        """
        try:
            url = f"{RealDebridIntegration.BASE_URL}/torrents/addMagnet"
            headers = {"Authorization": f"Bearer {token}"}
            data = {"magnet": magnet}
            
            response = requests.post(url, headers=headers, data=data, timeout=10)
            
            if response.status_code == 201:
                return response.json()
            else:
                logger.error(f"Real-Debrid add magnet failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error adding magnet to Real-Debrid: {e}")
            return None
    
    @staticmethod
    def select_files(torrent_id: str, file_ids: str, token: str) -> bool:
        """
        Select which files to download from torrent
        file_ids: comma-separated string like "1,2,3" or "all"
        """
        try:
            url = f"{RealDebridIntegration.BASE_URL}/torrents/selectFiles/{torrent_id}"
            headers = {"Authorization": f"Bearer {token}"}
            data = {"files": file_ids}
            
            response = requests.post(url, headers=headers, data=data, timeout=10)
            return response.status_code == 204
            
        except Exception as e:
            logger.error(f"Error selecting files: {e}")
            return False
    
    @staticmethod
    def get_torrent_info(torrent_id: str, token: str) -> Optional[Dict]:
        """Get info about a torrent"""
        try:
            url = f"{RealDebridIntegration.BASE_URL}/torrents/info/{torrent_id}"
            headers = {"Authorization": f"Bearer {token}"}
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error getting torrent info: {e}")
            return None
    
    @staticmethod
    def unrestrict_link(link: str, token: str) -> Optional[Dict]:
        """
        Unrestrict a hoster link to get direct download URL
        """
        try:
            url = f"{RealDebridIntegration.BASE_URL}/unrestrict/link"
            headers = {"Authorization": f"Bearer {token}"}
            data = {"link": link}
            
            response = requests.post(url, headers=headers, data=data, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Unrestrict failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error unrestricting link: {e}")
            return None
    
    @staticmethod
    def get_all_torrents(token: str) -> List[Dict]:
        """Get all user's torrents"""
        try:
            url = f"{RealDebridIntegration.BASE_URL}/torrents"
            headers = {"Authorization": f"Bearer {token}"}
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                return []
                
        except Exception as e:
            logger.error(f"Error getting torrents: {e}")
            return []
