"""
Test suite for Zeus Glass Log Upload API endpoints
Tests: POST /api/logs/upload, GET /api/logs, GET /api/logs/dashboard, DELETE /api/logs/clear
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://zeus-glass.preview.emergentagent.com').rstrip('/')


class TestLogUploadAPI:
    """Tests for the log upload and retrieval endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_device_id = f"TEST_device_{uuid.uuid4().hex[:8]}"
        self.test_logs = [
            {
                "id": f"log_{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.utcnow().isoformat(),
                "level": "error",
                "message": "Test error message from pytest",
                "context": "TestContext",
                "stack": "Error: Test stack trace\n  at test.py:1",
                "deviceInfo": {"platform": "test", "version": "1.0"}
            },
            {
                "id": f"log_{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.utcnow().isoformat(),
                "level": "warn",
                "message": "Test warning message",
                "context": "TestWarning"
            },
            {
                "id": f"log_{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.utcnow().isoformat(),
                "level": "info",
                "message": "Test info message",
                "context": "TestInfo"
            }
        ]
    
    def test_upload_logs_success(self):
        """POST /api/logs/upload - should accept logs and return success with log_count"""
        payload = {
            "device_id": self.test_device_id,
            "device_name": "Test Fire TV Device",
            "platform": "android-tv 10",
            "app_version": "1.5.0",
            "logs": self.test_logs
        }
        
        response = requests.post(f"{BASE_URL}/api/logs/upload", json=payload)
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "log_count" in data, "Response should contain log_count"
        assert data["log_count"] == len(self.test_logs), f"Expected log_count={len(self.test_logs)}, got {data['log_count']}"
        assert "message" in data, "Response should contain message"
        print(f"✓ Upload successful: {data['message']}")
    
    def test_upload_logs_minimal_payload(self):
        """POST /api/logs/upload - should work with minimal required fields"""
        payload = {
            "device_id": f"TEST_minimal_{uuid.uuid4().hex[:8]}",
            "logs": [
                {
                    "id": "log_minimal_1",
                    "timestamp": datetime.utcnow().isoformat(),
                    "level": "error",
                    "message": "Minimal test log"
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/logs/upload", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("log_count") == 1
        print("✓ Minimal payload upload successful")
    
    def test_upload_logs_missing_device_id(self):
        """POST /api/logs/upload - should fail without device_id"""
        payload = {
            "logs": self.test_logs
        }
        
        response = requests.post(f"{BASE_URL}/api/logs/upload", json=payload)
        
        # Should return 422 validation error
        assert response.status_code == 422, f"Expected 422 for missing device_id, got {response.status_code}"
        print("✓ Correctly rejected payload without device_id")
    
    def test_upload_logs_empty_logs_array(self):
        """POST /api/logs/upload - should handle empty logs array"""
        payload = {
            "device_id": f"TEST_empty_{uuid.uuid4().hex[:8]}",
            "logs": []
        }
        
        response = requests.post(f"{BASE_URL}/api/logs/upload", json=payload)
        
        # Should succeed but with 0 logs
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("log_count") == 0
        print("✓ Empty logs array handled correctly")


class TestLogRetrievalAPI:
    """Tests for GET /api/logs endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup_and_upload(self):
        """Upload test data before retrieval tests"""
        self.test_device_id = f"TEST_retrieval_{uuid.uuid4().hex[:8]}"
        test_logs = [
            {
                "id": f"log_{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.utcnow().isoformat(),
                "level": "error",
                "message": "Retrieval test error",
                "context": "RetrievalTest"
            }
        ]
        
        # Upload test data
        payload = {
            "device_id": self.test_device_id,
            "device_name": "Retrieval Test Device",
            "platform": "test",
            "app_version": "1.5.0",
            "logs": test_logs
        }
        requests.post(f"{BASE_URL}/api/logs/upload", json=payload)
    
    def test_get_logs_default(self):
        """GET /api/logs - should return stored logs with total count"""
        response = requests.get(f"{BASE_URL}/api/logs")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert "total" in data, "Response should contain total count"
        assert "uploads" in data, "Response should contain uploads array"
        assert isinstance(data["uploads"], list)
        print(f"✓ Retrieved logs: total={data['total']}, showing={data.get('showing', len(data['uploads']))}")
    
    def test_get_logs_with_limit(self):
        """GET /api/logs?limit=5 - should respect limit parameter"""
        response = requests.get(f"{BASE_URL}/api/logs", params={"limit": 5})
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["uploads"]) <= 5, f"Expected max 5 uploads, got {len(data['uploads'])}"
        print(f"✓ Limit parameter works: got {len(data['uploads'])} uploads")
    
    def test_get_logs_with_level_filter(self):
        """GET /api/logs?level=error - should filter by log level"""
        response = requests.get(f"{BASE_URL}/api/logs", params={"level": "error"})
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that all returned logs have level=error
        for upload in data["uploads"]:
            for log in upload.get("logs", []):
                assert log["level"] == "error", f"Expected level=error, got {log['level']}"
        print("✓ Level filter works correctly")
    
    def test_get_logs_no_mongodb_id(self):
        """GET /api/logs - should NOT include MongoDB _id in response"""
        response = requests.get(f"{BASE_URL}/api/logs", params={"limit": 10})
        
        assert response.status_code == 200
        data = response.json()
        
        for upload in data["uploads"]:
            assert "_id" not in upload, f"MongoDB _id should be excluded from response, found: {upload.keys()}"
        print("✓ MongoDB _id correctly excluded from responses")


class TestLogDashboardAPI:
    """Tests for GET /api/logs/dashboard endpoint"""
    
    def test_dashboard_returns_html(self):
        """GET /api/logs/dashboard - should return HTML page"""
        response = requests.get(f"{BASE_URL}/api/logs/dashboard")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Check content type is HTML
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected text/html, got {content_type}"
        
        # Check HTML contains expected elements
        html = response.text
        assert "Zeus Glass" in html, "Dashboard should contain 'Zeus Glass' title"
        assert "Log Dashboard" in html, "Dashboard should contain 'Log Dashboard'"
        # Dashboard uses window.location.origin + '/api' for API calls
        assert "/api" in html or "'/logs" in html, "Dashboard should reference logs endpoint"
        print("✓ Dashboard returns valid HTML page")
    
    def test_dashboard_has_required_features(self):
        """GET /api/logs/dashboard - should have refresh, export, clear buttons"""
        response = requests.get(f"{BASE_URL}/api/logs/dashboard")
        html = response.text
        
        assert "Refresh" in html, "Dashboard should have Refresh button"
        assert "Export" in html, "Dashboard should have Export button"
        assert "Clear All" in html, "Dashboard should have Clear All button"
        assert "levelFilter" in html, "Dashboard should have level filter"
        print("✓ Dashboard has all required UI features")


class TestLogClearAPI:
    """Tests for DELETE /api/logs/clear endpoint"""
    
    def test_clear_logs(self):
        """DELETE /api/logs/clear - should clear all stored logs"""
        # First upload some test data
        test_device_id = f"TEST_clear_{uuid.uuid4().hex[:8]}"
        payload = {
            "device_id": test_device_id,
            "logs": [
                {
                    "id": "log_to_clear",
                    "timestamp": datetime.utcnow().isoformat(),
                    "level": "info",
                    "message": "This log will be cleared"
                }
            ]
        }
        requests.post(f"{BASE_URL}/api/logs/upload", json=payload)
        
        # Clear all logs
        response = requests.delete(f"{BASE_URL}/api/logs/clear")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert "deleted" in data, "Response should contain deleted count"
        print(f"✓ Cleared {data['deleted']} log entries")
        
        # Verify logs are cleared
        get_response = requests.get(f"{BASE_URL}/api/logs")
        get_data = get_response.json()
        assert get_data["total"] == 0, f"Expected 0 logs after clear, got {get_data['total']}"
        print("✓ Verified logs are cleared")


class TestHealthAndBasicEndpoints:
    """Basic health check tests"""
    
    def test_api_root(self):
        """GET /api/ - should return hello world"""
        response = requests.get(f"{BASE_URL}/api/")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root responds: {data['message']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
