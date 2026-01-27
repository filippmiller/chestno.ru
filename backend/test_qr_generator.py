"""
Quick test for QR code image generation
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.qr_generator import generate_qr_image, generate_etag


def test_png_generation():
    """Test PNG QR code generation"""
    print("Testing PNG generation...")
    url = "https://chestno.ru/q/test123"
    image_data = generate_qr_image(url, format="png", size=300, error_correction="M")

    assert isinstance(image_data, bytes)
    assert len(image_data) > 1000, "PNG should be at least 1KB"
    assert image_data[:8] == b'\x89PNG\r\n\x1a\n', "Should have PNG magic bytes"
    print(f"✅ PNG generation: {len(image_data)} bytes")


def test_svg_generation():
    """Test SVG QR code generation"""
    print("Testing SVG generation...")
    url = "https://chestno.ru/q/test123"
    image_data = generate_qr_image(url, format="svg", size=300, error_correction="M")

    assert isinstance(image_data, bytes)
    svg_str = image_data.decode('utf-8')
    assert '<svg' in svg_str, "Should contain SVG tag"
    assert '</svg>' in svg_str, "Should have closing SVG tag"
    print(f"✅ SVG generation: {len(image_data)} bytes")


def test_etag_generation():
    """Test ETag generation"""
    print("Testing ETag generation...")
    etag1 = generate_etag("test123", "png", 300, "M")
    etag2 = generate_etag("test123", "png", 300, "M")
    etag3 = generate_etag("test123", "png", 400, "M")

    assert etag1 == etag2, "Same params should generate same ETag"
    assert etag1 != etag3, "Different params should generate different ETag"
    assert etag1.startswith('"') and etag1.endswith('"'), "ETag should be quoted"
    print(f"✅ ETag generation: {etag1}")


def test_different_error_corrections():
    """Test different error correction levels"""
    print("Testing error correction levels...")
    url = "https://chestno.ru/q/test123"

    for level in ["L", "M", "Q", "H"]:
        image_data = generate_qr_image(url, format="png", size=300, error_correction=level)
        assert len(image_data) > 1000
        print(f"  ✅ Level {level}: {len(image_data)} bytes")


def test_different_sizes():
    """Test different sizes"""
    print("Testing different sizes...")
    url = "https://chestno.ru/q/test123"

    sizes = [100, 300, 500, 1000, 2000]
    for size in sizes:
        image_data = generate_qr_image(url, format="png", size=size, error_correction="M")
        assert len(image_data) > 1000
        print(f"  ✅ Size {size}px: {len(image_data)} bytes")


def test_invalid_params():
    """Test validation"""
    print("Testing parameter validation...")
    url = "https://chestno.ru/q/test123"

    # Invalid size
    try:
        generate_qr_image(url, format="png", size=50, error_correction="M")
        assert False, "Should raise ValueError for size < 100"
    except ValueError:
        print("  ✅ Size validation works")

    # Invalid format
    try:
        generate_qr_image(url, format="jpg", size=300, error_correction="M")
        assert False, "Should raise ValueError for invalid format"
    except ValueError:
        print("  ✅ Format validation works")

    # Invalid error correction
    try:
        generate_qr_image(url, format="png", size=300, error_correction="X")
        assert False, "Should raise ValueError for invalid error correction"
    except ValueError:
        print("  ✅ Error correction validation works")


if __name__ == "__main__":
    print("=" * 60)
    print("QR GENERATOR TESTS")
    print("=" * 60)

    try:
        test_png_generation()
        test_svg_generation()
        test_etag_generation()
        test_different_error_corrections()
        test_different_sizes()
        test_invalid_params()

        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED")
        print("=" * 60)
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
