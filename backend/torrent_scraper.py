import requests
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class TorrentResult:
    def __init__(self, title: str, magnet: str, size: str, seeders: int, leechers: int, source: str):
        self.title = title
        self.magnet = magnet
        self.size = size
        self.seeders = seeders
        self.leechers = leechers
        self.source = source
        self.quality = self._extract_quality()
    
    def _extract_quality(self):
        """Extract quality from title"""
        title_upper = self.title.upper()
        if '2160P' in title_upper or '4K' in title_upper or 'UHD' in title_upper:
            return '2160p'
        elif '1080P' in title_upper:
            return '1080p'
        elif '720P' in title_upper:
            return '720p'
        elif '480P' in title_upper or 'HDTV' in title_upper:
            return '480p'
        return '720p'
    
    def to_dict(self):
        return {
            'title': self.title,
            'magnet': self.magnet,
            'size': self.size,
            'seeders': self.seeders,
            'leechers': self.leechers,
            'source': self.source,
            'quality': self.quality
        }


class Scraper1337x:
    """Scraper for 1337x.to"""
    BASE_URL = "https://1337x.to"
    SEARCH_URL = f"{BASE_URL}/search"
    
    @staticmethod
    def search(query: str, limit: int = 20) -> List[TorrentResult]:
        """Search 1337x for torrents"""
        results = []
        try:
            # Clean query
            clean_query = query.replace(' ', '+')
            url = f"{Scraper1337x.SEARCH_URL}/{clean_query}/1/"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                logger.warning(f"1337x returned status {response.status_code}")
                return results
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find torrent rows
            rows = soup.find_all('tr')
            
            for row in rows[:limit]:
                try:
                    # Get torrent name and link
                    name_cell = row.find('td', class_='name')
                    if not name_cell:
                        continue
                    
                    name_link = name_cell.find('a', href=re.compile(r'/torrent/'))
                    if not name_link:
                        continue
                    
                    title = name_link.get_text(strip=True)
                    torrent_url = Scraper1337x.BASE_URL + name_link['href']
                    
                    # Get seeders
                    seeds_cell = row.find('td', class_='seeds')
                    seeders = int(seeds_cell.get_text(strip=True)) if seeds_cell else 0
                    
                    # Get leechers
                    leeches_cell = row.find('td', class_='leeches')
                    leechers = int(leeches_cell.get_text(strip=True)) if leeches_cell else 0
                    
                    # Get size
                    size_cells = row.find_all('td')
                    size = size_cells[4].get_text(strip=True) if len(size_cells) > 4 else "Unknown"
                    
                    # Get magnet link from torrent page
                    magnet = Scraper1337x._get_magnet(torrent_url, headers)
                    
                    if magnet:
                        result = TorrentResult(
                            title=title,
                            magnet=magnet,
                            size=size,
                            seeders=seeders,
                            leechers=leechers,
                            source='1337x'
                        )
                        results.append(result)
                        
                except Exception as e:
                    logger.error(f"Error parsing 1337x row: {e}")
                    continue
            
        except Exception as e:
            logger.error(f"Error scraping 1337x: {e}")
        
        return results
    
    @staticmethod
    def _get_magnet(torrent_url: str, headers: dict) -> Optional[str]:
        """Get magnet link from torrent page"""
        try:
            response = requests.get(torrent_url, headers=headers, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            magnet_link = soup.find('a', href=re.compile(r'^magnet:\?'))
            if magnet_link:
                return magnet_link['href']
        except Exception as e:
            logger.error(f"Error getting magnet from {torrent_url}: {e}")
        return None


class ScraperYTS:
    """Scraper for YTS.mx (movies only)"""
    BASE_URL = "https://yts.mx/api/v2"
    
    @staticmethod
    def search(query: str, limit: int = 20) -> List[TorrentResult]:
        """Search YTS for movie torrents"""
        results = []
        try:
            url = f"{ScraperYTS.BASE_URL}/list_movies.json"
            params = {
                'query_term': query,
                'limit': limit
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code != 200:
                logger.warning(f"YTS returned status {response.status_code}")
                return results
            
            data = response.json()
            
            if data.get('status') != 'ok' or not data.get('data', {}).get('movies'):
                return results
            
            for movie in data['data']['movies'][:limit]:
                title_base = movie.get('title', 'Unknown')
                year = movie.get('year', '')
                
                torrents = movie.get('torrents', [])
                for torrent in torrents:
                    quality = torrent.get('quality', '720p')
                    hash_val = torrent.get('hash', '')
                    size = torrent.get('size', 'Unknown')
                    seeds = torrent.get('seeds', 0)
                    peers = torrent.get('peers', 0)
                    
                    if hash_val:
                        magnet = f"magnet:?xt=urn:btih:{hash_val}&dn={title_base}+{year}+{quality}"
                        
                        result = TorrentResult(
                            title=f"{title_base} ({year}) [{quality}]",
                            magnet=magnet,
                            size=size,
                            seeders=seeds,
                            leechers=peers,
                            source='YTS'
                        )
                        results.append(result)
            
        except Exception as e:
            logger.error(f"Error scraping YTS: {e}")
        
        return results


class ScraperPirateBay:
    """Scraper for The Pirate Bay via proxies"""
    BASE_URL = "https://thepiratebay.org"
    
    @staticmethod
    def search(query: str, limit: int = 20) -> List[TorrentResult]:
        """Search TPB for torrents"""
        results = []
        try:
            clean_query = query.replace(' ', '%20')
            url = f"{ScraperPirateBay.BASE_URL}/search/{clean_query}/1/99/0"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                logger.warning(f"PirateBay returned status {response.status_code}")
                return results
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find search results
            rows = soup.find_all('tr')[1:limit+1]  # Skip header
            
            for row in rows:
                try:
                    # Get title and magnet
                    title_cell = row.find('a', class_='detLink')
                    if not title_cell:
                        continue
                    
                    title = title_cell.get_text(strip=True)
                    
                    # Get magnet link
                    magnet_link = row.find('a', href=re.compile(r'^magnet:\?'))
                    if not magnet_link:
                        continue
                    
                    magnet = magnet_link['href']
                    
                    # Get size
                    desc_cell = row.find('font', class_='detDesc')
                    size = "Unknown"
                    if desc_cell:
                        size_match = re.search(r'Size ([^,]+)', desc_cell.get_text())
                        if size_match:
                            size = size_match.group(1)
                    
                    # Get seeders and leechers
                    td_cells = row.find_all('td')
                    seeders = int(td_cells[-2].get_text(strip=True)) if len(td_cells) >= 2 else 0
                    leechers = int(td_cells[-1].get_text(strip=True)) if len(td_cells) >= 1 else 0
                    
                    result = TorrentResult(
                        title=title,
                        magnet=magnet,
                        size=size,
                        seeders=seeders,
                        leechers=leechers,
                        source='PirateBay'
                    )
                    results.append(result)
                    
                except Exception as e:
                    logger.error(f"Error parsing PirateBay row: {e}")
                    continue
            
        except Exception as e:
            logger.error(f"Error scraping PirateBay: {e}")
        
        return results


class TorrentScraper:
    """Main torrent scraper that aggregates results from multiple sources"""
    
    @staticmethod
    def search_all(query: str, limit_per_source: int = 10) -> List[Dict]:
        """Search all torrent sources and aggregate results"""
        all_results = []
        
        # Try YTS first (best for movies)
        try:
            yts_results = ScraperYTS.search(query, limit_per_source)
            all_results.extend([r.to_dict() for r in yts_results])
            logger.info(f"YTS returned {len(yts_results)} results")
        except Exception as e:
            logger.error(f"YTS search failed: {e}")
        
        # Try 1337x
        try:
            x1337_results = Scraper1337x.search(query, limit_per_source)
            all_results.extend([r.to_dict() for r in x1337_results])
            logger.info(f"1337x returned {len(x1337_results)} results")
        except Exception as e:
            logger.error(f"1337x search failed: {e}")
        
        # Try PirateBay
        try:
            tpb_results = ScraperPirateBay.search(query, limit_per_source)
            all_results.extend([r.to_dict() for r in tpb_results])
            logger.info(f"PirateBay returned {len(tpb_results)} results")
        except Exception as e:
            logger.error(f"PirateBay search failed: {e}")
        
        # Sort by seeders (descending)
        all_results.sort(key=lambda x: x['seeders'], reverse=True)
        
        return all_results
    
    @staticmethod
    def search_movie(title: str, year: Optional[int] = None) -> List[Dict]:
        """Search specifically for movies"""
        query = f"{title}"
        if year:
            query += f" {year}"
        return TorrentScraper.search_all(query, limit_per_source=15)
    
    @staticmethod
    def search_tv_show(title: str, season: Optional[int] = None, episode: Optional[int] = None) -> List[Dict]:
        """Search specifically for TV shows"""
        query = f"{title}"
        if season and episode:
            query += f" S{season:02d}E{episode:02d}"
        elif season:
            query += f" S{season:02d}"
        return TorrentScraper.search_all(query, limit_per_source=15)
