"""
QR Code Image Generation Service

Uses the segno library for fast, dependency-free QR code generation.
Supports both PNG and SVG formats with on-the-fly generation (no storage).
"""
import hashlib
from io import BytesIO
from typing import Literal

import segno


def generate_qr_image(
    url: str,
    format: Literal["png", "svg"] = "png",
    size: int = 300,
    error_correction: Literal["L", "M", "Q", "H"] = "M",
) -> bytes:
    """
    Generate QR code image.

    Args:
        url: Target URL to encode in QR code
        format: Output format - "png" or "svg"
        size: Pixel size for PNG (100-2000), ignored for SVG
        error_correction: Error correction level
            - "L" (Low - 7%): Smallest codes, minimal damage tolerance
            - "M" (Medium - 15%): Default, balanced size and reliability
            - "Q" (Quartile - 25%): High reliability, recommended for print
            - "H" (High - 30%): Maximum reliability, outdoor/weathered materials

    Returns:
        bytes: Image data (PNG bytes or SVG string encoded as UTF-8)

    Raises:
        ValueError: Invalid parameters
    """
    if not url:
        raise ValueError("URL cannot be empty")

    if size < 100 or size > 2000:
        raise ValueError("Size must be between 100 and 2000 pixels")

    if format not in ("png", "svg"):
        raise ValueError("Format must be 'png' or 'svg'")

    if error_correction not in ("L", "M", "Q", "H"):
        raise ValueError("Error correction must be L, M, Q, or H")

    # Create QR code with segno
    qr = segno.make_qr(url, error=error_correction.lower())

    # Generate image
    buffer = BytesIO()

    if format == "png":
        # Calculate scale factor for PNG
        # Segno uses module size (individual squares in QR)
        # QR codes typically have 21-177 modules depending on data volume
        # Use a reasonable scale to approximate the target size
        scale = max(1, size // 30)  # Assume ~30 modules as average QR size
        qr.save(buffer, kind="png", scale=scale, border=1)
    else:  # svg
        # SVG is scalable, so size parameter is informative but not strictly enforced
        qr.save(buffer, kind="svg", border=1, xmldecl=False, svgclass=None)

    return buffer.getvalue()


def generate_etag(
    code: str,
    format: str,
    size: int,
    error_correction: str
) -> str:
    """
    Generate ETag for QR code image caching.

    Args:
        code: QR code identifier (unique code from database)
        format: Image format (png/svg)
        size: Image size in pixels
        error_correction: Error correction level

    Returns:
        ETag string with quotes (e.g., "a1b2c3d4")
    """
    tag_input = f"{code}:{format}:{size}:{error_correction}"
    hash_val = hashlib.sha256(tag_input.encode()).hexdigest()[:16]
    return f'"{hash_val}"'
