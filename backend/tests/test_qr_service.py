"""
QR Code Service Tests (No App Required)

Tests QR generator service functions directly without app initialization.
These tests can run without environment variables.
"""
import sys
from pathlib import Path
import importlib.util

# Add backend directory to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

# Import qr_generator directly without loading full app
qr_generator_path = backend_dir / "app" / "services" / "qr_generator.py"
spec = importlib.util.spec_from_file_location("qr_generator", qr_generator_path)
qr_generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qr_generator)

generate_qr_image = qr_generator.generate_qr_image
generate_etag = qr_generator.generate_etag


class TestQRGeneratorService:
    """Test QR generator service functions directly"""

    def test_generate_png_image(self):
        """Test PNG generation service"""
        url = "https://chestno.ru/q/test123"
        image_data = generate_qr_image(url, format="png", size=300, error_correction="M")

        assert isinstance(image_data, bytes)
        assert len(image_data) > 200
        assert image_data[:8] == b'\x89PNG\r\n\x1a\n'  # PNG magic bytes
        print(f"OK PNG generation: {len(image_data)} bytes")

    def test_generate_svg_image(self):
        """Test SVG generation service"""
        url = "https://chestno.ru/q/test123"
        image_data = generate_qr_image(url, format="svg", size=300, error_correction="M")

        assert isinstance(image_data, bytes)
        svg_str = image_data.decode('utf-8')
        assert '<svg' in svg_str
        assert '</svg>' in svg_str
        print(f"OK SVG generation: {len(image_data)} bytes")

    def test_generate_etag(self):
        """Test ETag generation"""
        etag1 = generate_etag("test123", "png", 300, "M")
        etag2 = generate_etag("test123", "png", 300, "M")
        etag3 = generate_etag("test123", "png", 400, "M")

        assert etag1 == etag2  # Same params = same ETag
        assert etag1 != etag3  # Different params = different ETag
        assert etag1.startswith('"') and etag1.endswith('"')
        print(f"OK ETag generation: {etag1}")

    def test_all_error_correction_levels(self):
        """Test all error correction levels"""
        url = "https://chestno.ru/q/test123"

        for level in ["L", "M", "Q", "H"]:
            image_data = generate_qr_image(url, format="png", size=300, error_correction=level)
            assert len(image_data) > 200
            print(f"  OK Level {level}: {len(image_data)} bytes")

    def test_different_sizes(self):
        """Test different image sizes"""
        url = "https://chestno.ru/q/test123"

        sizes = [100, 300, 500, 1000, 2000]
        for size in sizes:
            image_data = generate_qr_image(url, format="png", size=size, error_correction="M")
            assert len(image_data) > 200
            print(f"  OK Size {size}px: {len(image_data)} bytes")

    def test_validation_empty_url(self):
        """Test validation: empty URL"""
        try:
            generate_qr_image("", format="png", size=300, error_correction="M")
            assert False, "Should raise ValueError"
        except ValueError as e:
            assert "URL cannot be empty" in str(e)
        print(f"OK Empty URL validation works")

    def test_validation_invalid_size(self):
        """Test validation: invalid size"""
        try:
            generate_qr_image("https://test.com", format="png", size=50, error_correction="M")
            assert False, "Should raise ValueError"
        except ValueError as e:
            assert "Size must be between 100 and 2000" in str(e)
        print(f"OK Size validation works")

    def test_validation_invalid_format(self):
        """Test validation: invalid format"""
        try:
            generate_qr_image("https://test.com", format="jpg", size=300, error_correction="M")
            assert False, "Should raise ValueError"
        except ValueError as e:
            assert "Format must be 'png' or 'svg'" in str(e)
        print(f"OK Format validation works")

    def test_validation_invalid_error_correction(self):
        """Test validation: invalid error correction"""
        try:
            generate_qr_image("https://test.com", format="png", size=300, error_correction="X")
            assert False, "Should raise ValueError"
        except ValueError as e:
            assert "Error correction must be L, M, Q, or H" in str(e)
        print(f"OK Error correction validation works")


def run_all_tests():
    """Run all QR service tests"""
    print("=" * 60)
    print("QR CODE SERVICE TESTS (NO APP REQUIRED)")
    print("=" * 60)

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
    print("[OK] ALL SERVICE TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    try:
        run_all_tests()
    except Exception as e:
        print(f"\n[FAIL] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
