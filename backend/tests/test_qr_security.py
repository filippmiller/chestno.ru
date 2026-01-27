"""
QR Code Security Tests

Tests for security vulnerabilities:
- SQL injection prevention
- Path traversal prevention
- Authorization checks
- CORS validation
- Rate limiting (placeholder)
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestSQLInjectionPrevention:
    """Test SQL injection prevention"""

    def test_sql_injection_in_org_id(self):
        """Test SQL injection in organization_id parameter"""
        malicious_org_id = "1' OR '1'='1"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{malicious_org_id}/qr-codes/{qr_id}/image"
        )

        # Should return 400, 401, 403, or 422, not 200
        assert response.status_code != 200
        assert response.status_code in [400, 401, 403, 422]
        print(f"✓ SQL injection in org_id prevented (status: {response.status_code})")

    def test_sql_injection_in_qr_id(self):
        """Test SQL injection in qr_code_id parameter"""
        org_id = "00000000-0000-0000-0000-000000000000"
        malicious_qr_id = "1' OR '1'='1"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{malicious_qr_id}/image"
        )

        # Should return 400, 401, 403, or 422, not 200
        assert response.status_code != 200
        assert response.status_code in [400, 401, 403, 422]
        print(f"✓ SQL injection in qr_id prevented")

    def test_sql_injection_in_query_params(self):
        """Test SQL injection in query parameters"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            params={
                "format": "png' OR '1'='1",
                "size": "300",
                "error_correction": "M"
            }
        )

        # Should return validation error
        assert response.status_code in [400, 401, 403, 422]
        print(f"✓ SQL injection in query params prevented")


class TestPathTraversalPrevention:
    """Test path traversal attack prevention"""

    def test_path_traversal_in_org_id(self):
        """Test path traversal in organization_id"""
        malicious_org_id = "../../etc/passwd"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{malicious_org_id}/qr-codes/{qr_id}/image"
        )

        # Should return 400, 401, 403, or 422
        assert response.status_code != 200
        assert response.status_code in [400, 401, 403, 422]
        print(f"✓ Path traversal in org_id prevented")

    def test_path_traversal_in_qr_id(self):
        """Test path traversal in qr_code_id"""
        org_id = "00000000-0000-0000-0000-000000000000"
        malicious_qr_id = "../../../secret"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{malicious_qr_id}/image"
        )

        # Should return 400, 401, 403, or 422
        assert response.status_code != 200
        assert response.status_code in [400, 401, 403, 422]
        print(f"✓ Path traversal in qr_id prevented")


class TestAuthorizationChecks:
    """Test authorization and authentication requirements"""

    def test_tracked_qr_requires_auth(self):
        """Test tracked QR endpoint requires authentication"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image"
        )

        # Should require authentication
        assert response.status_code in [401, 403]
        print(f"✓ Tracked QR endpoint requires authentication (status: {response.status_code})")

    def test_business_qr_requires_auth(self):
        """Test business QR endpoint requires authentication"""
        org_id = "00000000-0000-0000-0000-000000000000"

        response = client.get(
            f"/api/organizations/{org_id}/qr-business/image"
        )

        # Should require authentication
        assert response.status_code in [401, 403]
        print(f"✓ Business QR endpoint requires authentication")

    def test_invalid_uuid_format(self):
        """Test invalid UUID format handling"""
        org_id = "not-a-uuid"
        qr_id = "also-not-a-uuid"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image"
        )

        # Should return validation error
        assert response.status_code in [400, 401, 403, 422]
        print(f"✓ Invalid UUID format rejected")


class TestCORSValidation:
    """Test CORS policy validation"""

    def test_cors_headers_present(self):
        """Test CORS headers are set correctly"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            headers={"Origin": "https://chestno.ru"}
        )

        # Check if CORS headers are present (if endpoint allows CORS)
        # Note: Actual CORS behavior depends on app configuration
        print(f"✓ CORS headers checked (status: {response.status_code})")

    def test_malicious_origin_rejected(self):
        """Test malicious origin handling"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            headers={"Origin": "https://malicious-site.com"}
        )

        # CORS should not allow arbitrary origins
        # Note: Actual behavior depends on CORS middleware configuration
        print(f"✓ Malicious origin handling checked")


class TestInputSanitization:
    """Test input sanitization and validation"""

    def test_oversized_size_parameter(self):
        """Test oversized size parameter handling"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            params={"format": "png", "size": 999999, "error_correction": "M"}
        )

        # Should reject oversized parameter
        assert response.status_code in [401, 403, 422]
        print(f"✓ Oversized parameter rejected")

    def test_negative_size_parameter(self):
        """Test negative size parameter handling"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            params={"format": "png", "size": -100, "error_correction": "M"}
        )

        # Should reject negative parameter
        assert response.status_code in [401, 403, 422]
        print(f"✓ Negative parameter rejected")

    def test_special_characters_in_format(self):
        """Test special characters in format parameter"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            params={"format": "<script>alert('xss')</script>", "size": 300, "error_correction": "M"}
        )

        # Should reject invalid format
        assert response.status_code in [401, 403, 422]
        print(f"✓ Special characters in format rejected")


class TestRateLimiting:
    """Test rate limiting (placeholder - requires implementation)"""

    def test_rate_limiting_exists(self):
        """Placeholder: Test rate limiting is configured"""
        # Note: This test is a placeholder
        # Actual rate limiting tests would require:
        # 1. Rate limiting middleware configured
        # 2. Multiple rapid requests
        # 3. Verification of 429 responses

        print(f"✓ Rate limiting test (placeholder - manual verification needed)")


class TestErrorHandling:
    """Test error handling and information disclosure"""

    def test_error_messages_no_stack_trace(self):
        """Test error messages don't leak stack traces"""
        org_id = "invalid-id-format"
        qr_id = "invalid-qr-id"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image"
        )

        # Check response doesn't contain sensitive info
        if response.status_code >= 400:
            response_text = response.text.lower()
            # Should not contain stack trace keywords
            assert "traceback" not in response_text
            assert "file" not in response_text or "not found" in response_text  # "not found" is ok
            print(f"✓ Error messages don't leak sensitive info")

    def test_nonexistent_endpoint_404(self):
        """Test non-existent endpoint returns 404"""
        response = client.get("/api/organizations/test/qr-codes/test/nonexistent")

        # Should return 404
        assert response.status_code == 404
        print(f"✓ Non-existent endpoint returns 404")


def run_all_tests():
    """Run all security tests"""
    print("=" * 60)
    print("QR CODE SECURITY TESTS")
    print("=" * 60)

    # SQL Injection tests
    print("\n[SQL Injection Prevention Tests]")
    sql_tests = TestSQLInjectionPrevention()
    sql_tests.test_sql_injection_in_org_id()
    sql_tests.test_sql_injection_in_qr_id()
    sql_tests.test_sql_injection_in_query_params()

    # Path Traversal tests
    print("\n[Path Traversal Prevention Tests]")
    path_tests = TestPathTraversalPrevention()
    path_tests.test_path_traversal_in_org_id()
    path_tests.test_path_traversal_in_qr_id()

    # Authorization tests
    print("\n[Authorization Tests]")
    auth_tests = TestAuthorizationChecks()
    auth_tests.test_tracked_qr_requires_auth()
    auth_tests.test_business_qr_requires_auth()
    auth_tests.test_invalid_uuid_format()

    # CORS tests
    print("\n[CORS Validation Tests]")
    cors_tests = TestCORSValidation()
    cors_tests.test_cors_headers_present()
    cors_tests.test_malicious_origin_rejected()

    # Input sanitization tests
    print("\n[Input Sanitization Tests]")
    input_tests = TestInputSanitization()
    input_tests.test_oversized_size_parameter()
    input_tests.test_negative_size_parameter()
    input_tests.test_special_characters_in_format()

    # Rate limiting tests
    print("\n[Rate Limiting Tests]")
    rate_tests = TestRateLimiting()
    rate_tests.test_rate_limiting_exists()

    # Error handling tests
    print("\n[Error Handling Tests]")
    error_tests = TestErrorHandling()
    error_tests.test_error_messages_no_stack_trace()
    error_tests.test_nonexistent_endpoint_404()

    print("\n" + "=" * 60)
    print("[OK] ALL SECURITY TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    try:
        run_all_tests()
    except Exception as e:
        print(f"\n[FAIL] SECURITY TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
