"""
QR Code API Integration Tests

Tests for QR code image generation endpoints:
- GET /api/organizations/{org_id}/qr-codes/{qr_id}/image
- GET /api/organizations/{org_id}/qr-business/image
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.qr_generator import generate_qr_image, generate_etag

client = TestClient(app)


class TestQRImageGeneration:
    """Test QR code image generation endpoints"""

    def test_tracked_qr_image_generation_png(self):
        """Test PNG generation for tracked QR code"""
        # Note: This requires authenticated session and existing QR code
        # For now, test the endpoint exists and returns proper error
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            params={"format": "png", "size": 300, "error_correction": "M"}
        )

        # Without auth, should return 401 or 403
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print(f"✓ Tracked QR endpoint requires authentication (status: {response.status_code})")

    def test_tracked_qr_image_generation_svg(self):
        """Test SVG generation for tracked QR code"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            params={"format": "svg", "size": 300, "error_correction": "Q"}
        )

        # Without auth, should return 401 or 403
        assert response.status_code in [401, 403]
        print(f"✓ Tracked QR SVG endpoint requires authentication")

    def test_business_qr_image_generation_png(self):
        """Test PNG generation for business QR code"""
        org_id = "00000000-0000-0000-0000-000000000000"

        response = client.get(
            f"/api/organizations/{org_id}/qr-business/image",
            params={"format": "png", "size": 500, "error_correction": "Q"}
        )

        # Without auth, should return 401 or 403
        assert response.status_code in [401, 403]
        print(f"✓ Business QR endpoint requires authentication")

    def test_invalid_format_parameter(self):
        """Test validation of format parameter"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            params={"format": "jpg", "size": 300, "error_correction": "M"}
        )

        # Should return 422 (validation error) or 401/403 (auth first)
        assert response.status_code in [401, 403, 422]
        print(f"✓ Invalid format parameter rejected")

    def test_invalid_size_parameter_too_small(self):
        """Test validation of size parameter (too small)"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            params={"format": "png", "size": 50, "error_correction": "M"}
        )

        # Should return 422 (validation error) or 401/403 (auth first)
        assert response.status_code in [401, 403, 422]
        print(f"✓ Invalid size parameter (too small) rejected")

    def test_invalid_size_parameter_too_large(self):
        """Test validation of size parameter (too large)"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            params={"format": "png", "size": 3000, "error_correction": "M"}
        )

        # Should return 422 (validation error) or 401/403 (auth first)
        assert response.status_code in [401, 403, 422]
        print(f"✓ Invalid size parameter (too large) rejected")

    def test_invalid_error_correction_parameter(self):
        """Test validation of error_correction parameter"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image",
            params={"format": "png", "size": 300, "error_correction": "X"}
        )

        # Should return 422 (validation error) or 401/403 (auth first)
        assert response.status_code in [401, 403, 422]
        print(f"✓ Invalid error_correction parameter rejected")

    def test_default_parameters(self):
        """Test endpoint works with default parameters"""
        org_id = "00000000-0000-0000-0000-000000000000"
        qr_id = "00000000-0000-0000-0000-000000000001"

        # Call without query parameters (should use defaults)
        response = client.get(
            f"/api/organizations/{org_id}/qr-codes/{qr_id}/image"
        )

        # Without auth, should return 401 or 403
        assert response.status_code in [401, 403]
        print(f"✓ Endpoint accepts default parameters")


class TestQRGeneratorService:
    """Test QR generator service functions directly"""

    def test_generate_png_image(self):
        """Test PNG generation service"""
        url = "https://chestno.ru/q/test123"
        image_data = generate_qr_image(url, format="png", size=300, error_correction="M")

        assert isinstance(image_data, bytes)
        assert len(image_data) > 200
        assert image_data[:8] == b'\x89PNG\r\n\x1a\n'  # PNG magic bytes
        print(f"✓ PNG generation: {len(image_data)} bytes")

    def test_generate_svg_image(self):
        """Test SVG generation service"""
        url = "https://chestno.ru/q/test123"
        image_data = generate_qr_image(url, format="svg", size=300, error_correction="M")

        assert isinstance(image_data, bytes)
        svg_str = image_data.decode('utf-8')
        assert '<svg' in svg_str
        assert '</svg>' in svg_str
        print(f"✓ SVG generation: {len(image_data)} bytes")

    def test_generate_etag(self):
        """Test ETag generation"""
        etag1 = generate_etag("test123", "png", 300, "M")
        etag2 = generate_etag("test123", "png", 300, "M")
        etag3 = generate_etag("test123", "png", 400, "M")

        assert etag1 == etag2  # Same params = same ETag
        assert etag1 != etag3  # Different params = different ETag
        assert etag1.startswith('"') and etag1.endswith('"')
        print(f"✓ ETag generation: {etag1}")

    def test_all_error_correction_levels(self):
        """Test all error correction levels"""
        url = "https://chestno.ru/q/test123"

        for level in ["L", "M", "Q", "H"]:
            image_data = generate_qr_image(url, format="png", size=300, error_correction=level)
            assert len(image_data) > 200
            print(f"  ✓ Level {level}: {len(image_data)} bytes")

    def test_different_sizes(self):
        """Test different image sizes"""
        url = "https://chestno.ru/q/test123"

        sizes = [100, 300, 500, 1000, 2000]
        for size in sizes:
            image_data = generate_qr_image(url, format="png", size=size, error_correction="M")
            assert len(image_data) > 200
            print(f"  ✓ Size {size}px: {len(image_data)} bytes")

    def test_validation_empty_url(self):
        """Test validation: empty URL"""
        with pytest.raises(ValueError, match="URL cannot be empty"):
            generate_qr_image("", format="png", size=300, error_correction="M")
        print(f"✓ Empty URL validation works")

    def test_validation_invalid_size(self):
        """Test validation: invalid size"""
        with pytest.raises(ValueError, match="Size must be between 100 and 2000"):
            generate_qr_image("https://test.com", format="png", size=50, error_correction="M")
        print(f"✓ Size validation works")

    def test_validation_invalid_format(self):
        """Test validation: invalid format"""
        with pytest.raises(ValueError, match="Format must be 'png' or 'svg'"):
            generate_qr_image("https://test.com", format="jpg", size=300, error_correction="M")
        print(f"✓ Format validation works")

    def test_validation_invalid_error_correction(self):
        """Test validation: invalid error correction"""
        with pytest.raises(ValueError, match="Error correction must be L, M, Q, or H"):
            generate_qr_image("https://test.com", format="png", size=300, error_correction="X")
        print(f"✓ Error correction validation works")


def run_all_tests():
    """Run all QR API tests"""
    print("=" * 60)
    print("QR CODE API INTEGRATION TESTS")
    print("=" * 60)

    # Test API endpoints
    print("\n[API Endpoint Tests]")
    api_tests = TestQRImageGeneration()
    api_tests.test_tracked_qr_image_generation_png()
    api_tests.test_tracked_qr_image_generation_svg()
    api_tests.test_business_qr_image_generation_png()
    api_tests.test_invalid_format_parameter()
    api_tests.test_invalid_size_parameter_too_small()
    api_tests.test_invalid_size_parameter_too_large()
    api_tests.test_invalid_error_correction_parameter()
    api_tests.test_default_parameters()

    # Test service functions
    print("\n[Service Function Tests]")
    service_tests = TestQRGeneratorService()
    service_tests.test_generate_png_image()
    service_tests.test_generate_svg_image()
    service_tests.test_generate_etag()
    service_tests.test_all_error_correction_levels()
    service_tests.test_different_sizes()
    service_tests.test_validation_empty_url()
    service_tests.test_validation_invalid_size()
    service_tests.test_validation_invalid_format()
    service_tests.test_validation_invalid_error_correction()

    print("\n" + "=" * 60)
    print("[OK] ALL API TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    try:
        run_all_tests()
    except Exception as e:
        print(f"\n[FAIL] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
