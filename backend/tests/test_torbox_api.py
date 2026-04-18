"""
TorBox API Endpoint Tests
Tests for the TorBox debrid service device code authentication flow
"""
import pytest
import requests
import os

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://zeus-glass.preview.emergentagent.com')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL.rstrip('/')


class TestTorBoxDeviceStart:
    """Tests for POST /api/debrid/torbox/device-start endpoint"""
    
    def test_device_start_returns_device_code(self):
        """Test that device-start endpoint returns device_code, user_code, verification_url"""
        response = requests.post(f"{BASE_URL}/api/debrid/torbox/device-start", timeout=20)
        
        # Should return 200 OK
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check for required fields in response
        # TorBox API returns data in a 'data' wrapper
        if 'data' in data:
            inner_data = data['data']
        else:
            inner_data = data
        
        # Verify device_code exists
        assert 'device_code' in inner_data, f"Missing device_code in response: {data}"
        assert inner_data['device_code'], "device_code should not be empty"
        
        # Verify user_code exists
        assert 'user_code' in inner_data, f"Missing user_code in response: {data}"
        assert inner_data['user_code'], "user_code should not be empty"
        
        # Verify verification_url exists
        assert 'verification_url' in inner_data, f"Missing verification_url in response: {data}"
        assert inner_data['verification_url'], "verification_url should not be empty"
        
        print(f"✓ TorBox device-start returned: device_code={inner_data['device_code'][:10]}..., user_code={inner_data['user_code']}")


class TestTorBoxDeviceToken:
    """Tests for POST /api/debrid/torbox/device-token endpoint"""
    
    def test_device_token_with_invalid_code_returns_pending(self):
        """Test that device-token with invalid code returns pending status (not crash)"""
        response = requests.post(
            f"{BASE_URL}/api/debrid/torbox/device-token",
            params={"device_code": "invalid_test_code_12345"},
            timeout=15
        )
        
        # Should return 200 with pending status OR 400 (both are acceptable)
        # The key is that it should NOT crash (500 error)
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # If 200, should have pending status
        if response.status_code == 200:
            # Check for pending status
            if 'status' in data:
                assert data['status'] == 'pending', f"Expected pending status, got: {data}"
            print(f"✓ TorBox device-token returned pending status for invalid code")
        else:
            print(f"✓ TorBox device-token returned 400 for invalid code (expected behavior)")
    
    def test_device_token_with_empty_code(self):
        """Test that device-token with empty code handles gracefully"""
        response = requests.post(
            f"{BASE_URL}/api/debrid/torbox/device-token",
            params={"device_code": ""},
            timeout=15
        )
        
        # Should not crash - any 4xx or 200 with error is acceptable
        assert response.status_code < 500, f"Server error: {response.status_code}: {response.text}"
        print(f"✓ TorBox device-token handled empty code gracefully (status: {response.status_code})")


class TestTorBoxAccountInfo:
    """Tests for GET /api/debrid/torbox/account-info endpoint"""
    
    def test_account_info_with_invalid_token_returns_error(self):
        """Test that account-info with invalid token returns error (not crash)"""
        response = requests.get(
            f"{BASE_URL}/api/debrid/torbox/account-info",
            params={"token": "invalid_test_token_12345"},
            timeout=15
        )
        
        # Should return 4xx error (401/403) but NOT 500
        assert response.status_code < 500, f"Server error: {response.status_code}: {response.text}"
        
        # 401 or 403 is expected for invalid token
        if response.status_code in [401, 403]:
            print(f"✓ TorBox account-info returned {response.status_code} for invalid token (expected)")
        else:
            print(f"✓ TorBox account-info returned {response.status_code} for invalid token")
    
    def test_account_info_with_empty_token(self):
        """Test that account-info with empty token handles gracefully"""
        response = requests.get(
            f"{BASE_URL}/api/debrid/torbox/account-info",
            params={"token": ""},
            timeout=15
        )
        
        # Should not crash
        assert response.status_code < 500, f"Server error: {response.status_code}: {response.text}"
        print(f"✓ TorBox account-info handled empty token gracefully (status: {response.status_code})")


class TestOtherDebridEndpoints:
    """Tests for other debrid endpoints to ensure they still work"""
    
    def test_real_debrid_device_code(self):
        """Test Real-Debrid device code endpoint"""
        response = requests.get(f"{BASE_URL}/api/debrid/real-debrid/device-code", timeout=15)
        
        # Should return 200 with device code
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'device_code' in data, f"Missing device_code: {data}"
        assert 'user_code' in data, f"Missing user_code: {data}"
        print(f"✓ Real-Debrid device-code working: user_code={data.get('user_code')}")
    
    def test_alldebrid_pin(self):
        """Test AllDebrid PIN endpoint"""
        response = requests.get(f"{BASE_URL}/api/debrid/alldebrid/pin", timeout=15)
        
        # Should return 200 with PIN data
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # AllDebrid returns status: success with data wrapper
        if data.get('status') == 'success':
            assert 'data' in data, f"Missing data wrapper: {data}"
            assert 'pin' in data['data'], f"Missing pin: {data}"
            print(f"✓ AllDebrid PIN working: pin={data['data'].get('pin')}")
        else:
            print(f"✓ AllDebrid PIN endpoint responded: {data}")


class TestAPIHealth:
    """Basic API health checks"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert response.status_code == 200, f"API root failed: {response.status_code}"
        print("✓ API root endpoint working")
    
    def test_torrentio_proxy(self):
        """Test Torrentio proxy endpoint - may be rate limited"""
        # Test with a known IMDB ID (The Matrix)
        response = requests.get(
            f"{BASE_URL}/api/torrentio/stream/movie/tt0133093.json",
            timeout=20
        )
        
        # Torrentio may return 403 due to rate limiting or bot protection
        # This is expected behavior for external API
        if response.status_code == 403:
            print(f"✓ Torrentio proxy returned 403 (rate limited/blocked - expected for external API)")
            pytest.skip("Torrentio is rate limiting - external API issue, not our code")
        
        # Should return 200 with streams
        assert response.status_code == 200, f"Torrentio proxy failed: {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'streams' in data, f"Missing streams in response: {data}"
        print(f"✓ Torrentio proxy working: {len(data.get('streams', []))} streams found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
