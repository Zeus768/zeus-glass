"""
Backend API Tests for Zeus Glass Debrid Features
Tests debrid cache search endpoints and related APIs
"""

import pytest
import requests
import os

# Use the public URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trakt-tv-app.preview.emergentagent.com').rstrip('/')


class TestHealthAndBasicEndpoints:
    """Health check and basic endpoint tests"""
    
    def test_root_endpoint(self):
        """Test root API endpoint returns success"""
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Hello World"
        print(f"✓ Root endpoint working: {data}")
    
    def test_status_endpoint_get(self):
        """Test status endpoint GET"""
        response = requests.get(f"{BASE_URL}/api/status", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Status GET endpoint working, returned {len(data)} items")
    
    def test_status_endpoint_post(self):
        """Test status endpoint POST"""
        payload = {"client_name": "pytest_test_client"}
        response = requests.post(f"{BASE_URL}/api/status", json=payload, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "client_name" in data
        assert data["client_name"] == "pytest_test_client"
        assert "id" in data
        print(f"✓ Status POST endpoint working: {data['id']}")


class TestDebridCacheSearchMovie:
    """Test debrid cache search for movies - critical feature"""
    
    def test_cache_search_movie_with_title_only(self):
        """Test movie cache search with title only (no IMDB ID)"""
        params = {
            "title": "Inception",
            "token": "test",  # Test token for checking endpoint structure
            "year": 2010
        }
        response = requests.get(f"{BASE_URL}/api/debrid/cache/search/movie", params=params, timeout=30)
        
        # Check response status
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "success" in data
        assert "count" in data
        assert "results" in data
        assert "source" in data
        
        print(f"✓ Movie cache search (title only) returned {data['count']} results")
        print(f"  Source: {data['source']}")
        
        # If results found, validate result structure
        if data['results']:
            first_result = data['results'][0]
            print(f"  Sample result: {first_result.get('title', 'N/A')[:50]}")
            # Validate required fields in result
            assert 'hash' in first_result or 'title' in first_result

    def test_cache_search_movie_with_imdb_id(self):
        """Test movie cache search WITH IMDB ID - this is the key fix being tested"""
        params = {
            "title": "Inception",
            "token": "test",
            "year": 2010,
            "imdb_id": "tt1375666"  # Inception's real IMDB ID
        }
        response = requests.get(f"{BASE_URL}/api/debrid/cache/search/movie", params=params, timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "count" in data
        assert "results" in data
        
        print(f"✓ Movie cache search (with IMDB ID) returned {data['count']} results")
        
        # With IMDB ID, we expect results from indexers
        # Note: Results depend on external indexers availability
        if data['count'] > 0:
            print(f"  ✓ Found {data['count']} results using IMDB ID - debrid indexers working!")
            # Validate result structure
            first = data['results'][0]
            assert 'hash' in first
            assert 'quality' in first
            assert 'cached' in first
            print(f"  First result quality: {first.get('quality')}, cached: {first.get('cached')}")
        else:
            print(f"  Note: No results found (indexers may be down or have no cached content)")
    
    def test_cache_search_movie_popular_title(self):
        """Test with a very popular movie that should have results"""
        params = {
            "title": "The Avengers",
            "token": "test",
            "year": 2012,
            "imdb_id": "tt0848228"  # The Avengers IMDB ID
        }
        response = requests.get(f"{BASE_URL}/api/debrid/cache/search/movie", params=params, timeout=30)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        print(f"✓ Popular movie (The Avengers) cache search returned {data['count']} results")
        
        if data['count'] > 0:
            # Check quality distribution
            qualities = [r.get('quality', 'unknown') for r in data['results']]
            print(f"  Quality distribution: {set(qualities)}")


class TestDebridCacheSearchTV:
    """Test debrid cache search for TV shows"""
    
    def test_cache_search_tv_with_imdb_id(self):
        """Test TV show cache search with IMDB ID"""
        params = {
            "title": "Breaking Bad",
            "token": "test",
            "season": 1,
            "episode": 1,
            "imdb_id": "tt0903747"  # Breaking Bad IMDB ID
        }
        response = requests.get(f"{BASE_URL}/api/debrid/cache/search/tv", params=params, timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert "count" in data
        assert "results" in data
        
        print(f"✓ TV cache search returned {data['count']} results")
    
    def test_cache_search_tv_different_episodes(self):
        """Test TV cache search with different season/episode"""
        params = {
            "title": "Game of Thrones",
            "token": "test",
            "season": 1,
            "episode": 1,
            "imdb_id": "tt0944947"
        }
        response = requests.get(f"{BASE_URL}/api/debrid/cache/search/tv", params=params, timeout=30)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        print(f"✓ TV cache search (GoT S01E01) returned {data['count']} results")


class TestDebridStreamEndpoint:
    """Test the stream link generation endpoint"""
    
    def test_get_stream_link_invalid_hash(self):
        """Test stream endpoint with invalid hash - should fail gracefully"""
        params = {
            "hash": "0000000000000000000000000000000000000000",  # Invalid hash
            "token": "test"
        }
        response = requests.get(f"{BASE_URL}/api/debrid/cache/stream", params=params, timeout=15)
        
        # Should return 404 or error, not crash
        assert response.status_code in [200, 404, 400, 500]
        print(f"✓ Stream endpoint handles invalid hash: status {response.status_code}")


class TestDebridAllDebridCacheCheck:
    """Test AllDebrid cache check endpoint"""
    
    def test_alldebrid_cache_check_endpoint(self):
        """Test AllDebrid cache check endpoint exists and responds"""
        params = {
            "hashes": "0000000000000000000000000000000000000000",
            "apikey": "test_key"
        }
        response = requests.get(f"{BASE_URL}/api/debrid/alldebrid/cache/check", params=params, timeout=15)
        
        # Endpoint should exist - may return error due to invalid API key
        assert response.status_code in [200, 400, 401, 500]
        print(f"✓ AllDebrid cache check endpoint exists: status {response.status_code}")


class TestDebridPremiumizeCacheCheck:
    """Test Premiumize cache check endpoint"""
    
    def test_premiumize_cache_check_endpoint(self):
        """Test Premiumize cache check endpoint exists and responds"""
        params = {
            "hashes": "0000000000000000000000000000000000000000",
            "apikey": "test_key"
        }
        response = requests.get(f"{BASE_URL}/api/debrid/premiumize/cache/check", params=params, timeout=15)
        
        # Endpoint should exist
        assert response.status_code in [200, 400, 401, 500]
        print(f"✓ Premiumize cache check endpoint exists: status {response.status_code}")


class TestTorrentioEndpoints:
    """Test Torrentio indexer endpoints"""
    
    def test_torrentio_movie_endpoint(self):
        """Test Torrentio movie search endpoint"""
        params = {
            "imdb_id": "tt1375666",  # Inception
            "title": "Inception",
            "year": 2010
        }
        response = requests.get(f"{BASE_URL}/api/torrents/torrentio/movie", params=params, timeout=30)
        
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "results" in data
        assert "source" in data
        assert data["source"] == "Torrentio"
        
        print(f"✓ Torrentio movie endpoint: {data['count']} results")
    
    def test_torrentio_tv_endpoint(self):
        """Test Torrentio TV search endpoint"""
        params = {
            "imdb_id": "tt0903747",  # Breaking Bad
            "title": "Breaking Bad",
            "season": 1,
            "episode": 1
        }
        response = requests.get(f"{BASE_URL}/api/torrents/torrentio/tv", params=params, timeout=30)
        
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "source" in data
        
        print(f"✓ Torrentio TV endpoint: {data['count']} results")


class TestRealDebridAuthProxyEndpoints:
    """Test Real-Debrid OAuth proxy endpoints"""
    
    def test_device_code_endpoint(self):
        """Test Real-Debrid device code endpoint"""
        response = requests.get(f"{BASE_URL}/api/debrid/real-debrid/device-code", timeout=15)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return OAuth device code flow data
        assert "device_code" in data
        assert "user_code" in data
        assert "verification_url" in data
        
        print(f"✓ Real-Debrid device code endpoint working")
        print(f"  User code: {data.get('user_code', 'N/A')}")
        print(f"  Verification URL: {data.get('verification_url', 'N/A')}")


class TestAllDebridAuthProxyEndpoints:
    """Test AllDebrid auth proxy endpoints"""
    
    def test_alldebrid_pin_endpoint(self):
        """Test AllDebrid PIN generation endpoint"""
        response = requests.get(f"{BASE_URL}/api/debrid/alldebrid/pin", timeout=15)
        
        # Check endpoint responds
        assert response.status_code == 200
        data = response.json()
        
        # AllDebrid returns status and data
        assert "status" in data
        print(f"✓ AllDebrid PIN endpoint: status={data.get('status')}")


class TestTorrentSearchEndpoints:
    """Test general torrent search endpoints"""
    
    def test_torrent_search(self):
        """Test basic torrent search"""
        params = {"query": "test", "limit": 5}
        response = requests.get(f"{BASE_URL}/api/torrents/search", params=params, timeout=15)
        
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "results" in data
        
        print(f"✓ Torrent search endpoint: {data.get('count', 0)} results")
    
    def test_movie_torrent_search(self):
        """Test movie-specific torrent search"""
        params = {"title": "Inception", "year": 2010}
        response = requests.get(f"{BASE_URL}/api/torrents/movie", params=params, timeout=15)
        
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        
        print(f"✓ Movie torrent search endpoint: {data.get('count', 0)} results")
    
    def test_tv_torrent_search(self):
        """Test TV torrent search"""
        params = {"title": "Breaking Bad", "season": 1, "episode": 1}
        response = requests.get(f"{BASE_URL}/api/torrents/tv", params=params, timeout=15)
        
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        
        print(f"✓ TV torrent search endpoint: {data.get('count', 0)} results")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
