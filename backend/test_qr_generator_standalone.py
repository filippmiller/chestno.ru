"""
Standalone test for QR code generation (no app imports)
"""
import hashlib
from io import BytesIO
import segno


def generate_qr_image(url, format="png", size=300, error_correction="M"):
    """Generate QR code image"""
    if not url:
        raise ValueError("URL cannot be empty")
    if size < 100 or size > 2000:
        raise ValueError("Size must be between 100 and 2000 pixels")
    if format not in ("png", "svg"):
        raise ValueError("Format must be 'png' or 'svg'")
    if error_correction not in ("L", "M", "Q", "H"):
        raise ValueError("Error correction must be L, M, Q, or H")

    qr = segno.make_qr(url, error=error_correction.lower())
    buffer = BytesIO()

    if format == "png":
        # Calculate scale: QR codes are typically 21-177 modules
        # Use a reasonable scale to approximate the target size
        scale = max(1, size // 30)  # Assume ~30 modules as average
        qr.save(buffer, kind="png", scale=scale, border=1)
    else:  # svg
        qr.save(buffer, kind="svg", border=1, xmldecl=False, svgclass=None)

    return buffer.getvalue()


def generate_etag(code, format, size, error_correction):
    """Generate ETag"""
    tag_input = f"{code}:{format}:{size}:{error_correction}"
    hash_val = hashlib.sha256(tag_input.encode()).hexdigest()[:16]
    return f'"{hash_val}"'


def test_png_generation():
    """Test PNG QR code generation"""
    print("Testing PNG generation...")
    url = "https://chestno.ru/q/test123"
    image_data = generate_qr_image(url, format="png", size=300, error_correction="M")

    assert isinstance(image_data, bytes)
    assert len(image_data) > 200, f"PNG should be at least 200 bytes, got {len(image_data)}"
    assert image_data[:8] == b'\x89PNG\r\n\x1a\n', "Should have PNG magic bytes"
    print(f"OK PNG generation: {len(image_data)} bytes")


def test_svg_generation():
    """Test SVG QR code generation"""
    print("Testing SVG generation...")
    url = "https://chestno.ru/q/test123"
    image_data = generate_qr_image(url, format="svg", size=300, error_correction="M")

    assert isinstance(image_data, bytes)
    svg_str = image_data.decode('utf-8')
    assert '<svg' in svg_str, "Should contain SVG tag"
    assert '</svg>' in svg_str, "Should have closing SVG tag"
    print(f"OK SVG generation: {len(image_data)} bytes")


def test_etag_generation():
    """Test ETag generation"""
    print("Testing ETag generation...")
    etag1 = generate_etag("test123", "png", 300, "M")
    etag2 = generate_etag("test123", "png", 300, "M")
    etag3 = generate_etag("test123", "png", 400, "M")

    assert etag1 == etag2, "Same params should generate same ETag"
    assert etag1 != etag3, "Different params should generate different ETag"
    assert etag1.startswith('"') and etag1.endswith('"'), "ETag should be quoted"
    print(f"OK ETag generation: {etag1}")


def test_different_error_corrections():
    """Test different error correction levels"""
    print("Testing error correction levels...")
    url = "https://chestno.ru/q/test123"

    for level in ["L", "M", "Q", "H"]:
        image_data = generate_qr_image(url, format="png", size=300, error_correction=level)
        assert len(image_data) > 200  # Different error correction levels produce different sizes
        print(f"  OK Level {level}: {len(image_data)} bytes")


def test_different_sizes():
    """Test different sizes"""
    print("Testing different sizes...")
    url = "https://chestno.ru/q/test123"

    sizes = [100, 300, 500, 1000, 2000]
    for size in sizes:
        image_data = generate_qr_image(url, format="png", size=size, error_correction="M")
        assert len(image_data) > 200  # Adjust based on actual QR code size
        print(f"  OK Size {size}px: {len(image_data)} bytes")


def test_invalid_params():
    """Test validation"""
    print("Testing parameter validation...")
    url = "https://chestno.ru/q/test123"

    # Invalid size
    try:
        generate_qr_image(url, format="png", size=50, error_correction="M")
        assert False, "Should raise ValueError for size < 100"
    except ValueError:
        print("  OK Size validation works")

    # Invalid format
    try:
        generate_qr_image(url, format="jpg", size=300, error_correction="M")
        assert False, "Should raise ValueError for invalid format"
    except ValueError:
        print("  OK Format validation works")

    # Invalid error correction
    try:
        generate_qr_image(url, format="png", size=300, error_correction="X")
        assert False, "Should raise ValueError for invalid error correction"
    except ValueError:
        print("  OK Error correction validation works")


if __name__ == "__main__":
    print("=" * 60)
    print("QR GENERATOR STANDALONE TESTS")
    print("=" * 60)

    try:
        test_png_generation()
        test_svg_generation()
        test_etag_generation()
        test_different_error_corrections()
        test_different_sizes()
        test_invalid_params()

        print("\n" + "=" * 60)
        print("[OK] ALL TESTS PASSED")
        print("=" * 60)
    except Exception as e:
        print(f"\n[FAIL] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        import sys
        sys.exit(1)
