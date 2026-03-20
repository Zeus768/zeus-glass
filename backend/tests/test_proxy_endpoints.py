"""
Backend API tests for Zeus Glass proxy endpoints
Tests the /api/proxy/fetch and /api/proxy/test endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://zeus-glass.preview.emergentagent.com')

class TestProxyEndpoints:
    """Tests for VPN/Proxy streaming endpoints"""
    
    def test_proxy_test_endpoint_exists(self):
        """Test that /api/proxy/test endpoint exists and accepts proxy_url parameter"""
        # Using a public proxy URL for testing
        test_proxy = "http://198.59.191.234:8080"
        response = requests.get(
            f"{BASE_URL}/api/proxy/test",
            params={"proxy_url": test_proxy},
            timeout=20
        )
        # Should return 200 even if proxy fails (returns success: false)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Response should have success field
        assert "success" in data, "Response should have 'success' field"
        # Note: success may be false for unreliable public proxies - that's expected
        print(f"Proxy test response: {data}")
    
    def test_proxy_fetch_endpoint_exists(self):
        """Test that /api/proxy/fetch POST endpoint exists"""
        test_proxy = "http://198.59.191.234:8080"
        payload = {
            "url": "https://httpbin.org/get",
            "proxy_url": test_proxy,
            "method": "GET",
            "headers": {}
        }
        response = requests.post(
            f"{BASE_URL}/api/proxy/fetch",
            json=payload,
            timeout=30
        )
        # Should return 200 or 502 (proxy error) - not 404
        assert response.status_code in [200, 502], f"Expected 200 or 502, got {response.status_code}"
        print(f"Proxy fetch response status: {response.status_code}")
    
    def test_proxy_fetch_with_invalid_proxy(self):
        """Test proxy fetch with invalid proxy returns appropriate error"""
        payload = {
            "url": "https://httpbin.org/get",
            "proxy_url": "http://invalid-proxy:9999",
            "method": "GET",
            "headers": {}
        }
        response = requests.post(
            f"{BASE_URL}/api/proxy/fetch",
            json=payload,
            timeout=30
        )
        # Should return 502 for proxy failure
        assert response.status_code == 502, f"Expected 502 for invalid proxy, got {response.status_code}"
    
    def test_proxy_test_with_invalid_proxy(self):
        """Test proxy test with invalid proxy returns success: false"""
        response = requests.get(
            f"{BASE_URL}/api/proxy/test",
            params={"proxy_url": "http://invalid-proxy:9999"},
            timeout=15
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False, "Invalid proxy should return success: false"
        assert "error" in data, "Should include error message"
        print(f"Invalid proxy test response: {data}")


class TestCoreEndpoints:
    """Tests for core API endpoints"""
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Root endpoint response: {data}")
    
    def test_torrentio_proxy_endpoint(self):
        """Test Torrentio proxy endpoint exists"""
        # Test with a known IMDB ID (The Matrix)
        response = requests.get(
            f"{BASE_URL}/api/torrentio/stream/movie/tt0133093",
            timeout=20
        )
        # Should return 200 with streams array
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "streams" in data, "Response should have 'streams' field"
        print(f"Torrentio proxy returned {len(data.get('streams', []))} streams")
    
    def test_trakt_device_code_endpoint(self):
        """Test Trakt device code endpoint for QR auth"""
        response = requests.post(
            f"{BASE_URL}/api/trakt/device/code",
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Should have device_code and user_code for QR auth
        assert "device_code" in data, "Should have device_code"
        assert "user_code" in data, "Should have user_code"
        assert "verification_url" in data, "Should have verification_url"
        print(f"Trakt device code: {data.get('user_code')}")
    
    def test_real_debrid_device_code_endpoint(self):
        """Test Real-Debrid device code endpoint for QR auth"""
        response = requests.get(
            f"{BASE_URL}/api/debrid/real-debrid/device-code",
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Should have device_code and user_code for QR auth
        assert "device_code" in data, "Should have device_code"
        assert "user_code" in data, "Should have user_code"
        assert "verification_url" in data, "Should have verification_url"
        print(f"Real-Debrid device code: {data.get('user_code')}")
    
    def test_alldebrid_pin_endpoint(self):
        """Test AllDebrid PIN endpoint for QR auth"""
        response = requests.get(
            f"{BASE_URL}/api/debrid/alldebrid/pin",
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # AllDebrid returns data in 'data' field
        assert "data" in data or "pin" in data, "Should have auth data"
        print(f"AllDebrid PIN response: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
