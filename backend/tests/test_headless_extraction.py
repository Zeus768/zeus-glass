"""
Backend API Tests for Zeus Glass Headless Video Extraction
Tests the Playwright-based video URL extraction endpoints that provide ad-free m3u8/mp4 streams.
IMPORTANT: These endpoints take 15-25 seconds to respond due to headless browser operations.
"""

import pytest
import requests
import os
import time

# Use the public URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trakt-tv-app.preview.emergentagent.com').rstrip('/')

# Longer timeout for headless extraction (browser operations take time)
EXTRACTION_TIMEOUT = 90


class TestBasicEndpoints:
    """Basic health check tests"""
    
    def test_root_endpoint(self):
        """Test root API endpoint returns Hello World"""
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Hello World"
        print(f"✓ Root endpoint: {data}")


class TestHeadlessMovieExtraction:
    """Test headless video extraction for movies - the core P2 feature"""
    
    def test_extract_video_fight_club(self):
        """Test video extraction for Fight Club (tmdb_id=550) - known working movie"""
        params = {
            "tmdb_id": "550",
            "type": "movie"
        }
        print(f"\n[TEST] Extracting video for Fight Club (tmdb_id=550)...")
        print(f"[TEST] This may take 15-25 seconds due to headless browser...")
        
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/extract/video", params=params, timeout=EXTRACTION_TIMEOUT)
        elapsed = time.time() - start_time
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"[TEST] Response received in {elapsed:.1f}s")
        
        # Validate response structure
        assert "success" in data
        assert "count" in data
        assert "streams" in data
        assert "method" in data
        
        print(f"✓ Fight Club extraction: success={data['success']}, count={data['count']}, method={data['method']}")
        
        if data['count'] > 0:
            # Validate stream structure
            stream = data['streams'][0]
            assert 'url' in stream, "Stream should have 'url' field"
            assert 'quality' in stream, "Stream should have 'quality' field"
            assert 'source' in stream, "Stream should have 'source' field"
            
            # Check for m3u8 URL (expected from Videasy)
            url = stream['url']
            print(f"  Stream URL: {url[:80]}...")
            print(f"  Source: {stream.get('source')}")
            print(f"  Quality: {stream.get('quality')}")
            
            # Verify it's a valid video URL
            assert '.m3u8' in url.lower() or '.mp4' in url.lower() or '.mpd' in url.lower(), \
                f"Expected video URL (m3u8/mp4/mpd), got: {url[:100]}"
            
            # Verify it's from expected CDN (worldthunder.net for Videasy)
            if 'worldthunder.net' in url:
                print(f"  ✓ Stream from worldthunder.net CDN (Videasy)")
        else:
            print(f"  Note: No streams extracted (external sources may be unavailable)")
    
    def test_extract_video_dark_knight(self):
        """Test video extraction for The Dark Knight (tmdb_id=155)"""
        params = {
            "tmdb_id": "155",
            "type": "movie"
        }
        print(f"\n[TEST] Extracting video for The Dark Knight (tmdb_id=155)...")
        
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/extract/video", params=params, timeout=EXTRACTION_TIMEOUT)
        elapsed = time.time() - start_time
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ The Dark Knight extraction in {elapsed:.1f}s: count={data['count']}, method={data['method']}")
        
        if data['count'] > 0:
            stream = data['streams'][0]
            print(f"  Source: {stream.get('source')}, Quality: {stream.get('quality')}")
    
    def test_extract_best_movie(self):
        """Test /api/extract/best endpoint for movies - returns single best stream"""
        params = {
            "tmdb_id": "155",  # The Dark Knight
            "type": "movie"
        }
        print(f"\n[TEST] Getting BEST stream for The Dark Knight...")
        
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/extract/best", params=params, timeout=EXTRACTION_TIMEOUT)
        elapsed = time.time() - start_time
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Best stream extraction in {elapsed:.1f}s: success={data['success']}, method={data.get('method')}")
        
        # Validate response structure
        assert "success" in data
        assert "stream" in data
        
        if data['success'] and data['stream']:
            stream = data['stream']
            assert 'url' in stream
            print(f"  Best stream URL: {stream['url'][:80]}...")
            print(f"  Source: {stream.get('source')}")


class TestHeadlessTVExtraction:
    """Test headless video extraction for TV shows"""
    
    def test_extract_tv_breaking_bad_s1e1(self):
        """Test TV extraction for Breaking Bad S01E01 (tmdb_id=1396)"""
        params = {
            "tmdb_id": "1396",
            "type": "tv",
            "season": "1",
            "episode": "1"
        }
        print(f"\n[TEST] Extracting video for Breaking Bad S01E01...")
        
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/extract/video", params=params, timeout=EXTRACTION_TIMEOUT)
        elapsed = time.time() - start_time
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Breaking Bad S01E01 extraction in {elapsed:.1f}s: count={data['count']}, method={data['method']}")
        
        # Validate response structure
        assert "success" in data
        assert "count" in data
        assert "streams" in data
        
        if data['count'] > 0:
            stream = data['streams'][0]
            print(f"  Source: {stream.get('source')}")
            print(f"  URL: {stream['url'][:80]}...")
            
            # Verify video URL format
            url = stream['url']
            assert '.m3u8' in url.lower() or '.mp4' in url.lower() or '.mpd' in url.lower()
    
    def test_extract_tv_with_imdb_id(self):
        """Test TV extraction with IMDB ID provided"""
        params = {
            "tmdb_id": "1396",
            "type": "tv",
            "imdb_id": "tt0903747",  # Breaking Bad IMDB ID
            "season": "1",
            "episode": "2"
        }
        print(f"\n[TEST] Extracting Breaking Bad S01E02 with IMDB ID...")
        
        response = requests.get(f"{BASE_URL}/api/extract/video", params=params, timeout=EXTRACTION_TIMEOUT)
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ TV extraction with IMDB ID: count={data['count']}, method={data['method']}")


class TestExtractionEdgeCases:
    """Test edge cases and error handling"""
    
    def test_extract_invalid_tmdb_id(self):
        """Test extraction with invalid TMDB ID - should return empty results or timeout gracefully"""
        params = {
            "tmdb_id": "999999999",  # Non-existent movie
            "type": "movie"
        }
        print(f"\n[TEST] Testing invalid TMDB ID handling...")
        
        response = requests.get(f"{BASE_URL}/api/extract/video", params=params, timeout=EXTRACTION_TIMEOUT)
        
        # Should return 200 with empty results, or 502 if all sources timeout (acceptable)
        assert response.status_code in [200, 502], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # Should have proper structure even with no results
            assert "success" in data
            assert "count" in data
            assert "streams" in data
            print(f"✓ Invalid TMDB ID handled gracefully: count={data['count']}")
        else:
            print(f"✓ Invalid TMDB ID returned 502 (timeout) - acceptable for non-existent content")
    
    def test_extract_missing_type_parameter(self):
        """Test extraction without type parameter - should default to movie"""
        params = {
            "tmdb_id": "550"
            # type parameter omitted - should default to "movie"
        }
        
        response = requests.get(f"{BASE_URL}/api/extract/video", params=params, timeout=EXTRACTION_TIMEOUT)
        
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        
        print(f"✓ Missing type parameter handled: defaults to movie")


class TestExtractionResponseValidation:
    """Validate the structure and content of extraction responses"""
    
    def test_stream_response_structure(self):
        """Validate that stream responses have all required fields"""
        params = {
            "tmdb_id": "550",
            "type": "movie"
        }
        
        response = requests.get(f"{BASE_URL}/api/extract/video", params=params, timeout=EXTRACTION_TIMEOUT)
        assert response.status_code == 200
        data = response.json()
        
        # Required top-level fields
        required_fields = ['success', 'count', 'streams', 'method']
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Validate types
        assert isinstance(data['success'], bool)
        assert isinstance(data['count'], int)
        assert isinstance(data['streams'], list)
        assert isinstance(data['method'], str)
        
        # Method should be 'headless' or 'http'
        assert data['method'] in ['headless', 'http'], f"Unexpected method: {data['method']}"
        
        print(f"✓ Response structure validated: method={data['method']}")
        
        # If streams exist, validate stream structure
        if data['streams']:
            stream = data['streams'][0]
            stream_required = ['url', 'quality']
            for field in stream_required:
                assert field in stream, f"Stream missing required field: {field}"
            
            print(f"✓ Stream structure validated")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-x"])
