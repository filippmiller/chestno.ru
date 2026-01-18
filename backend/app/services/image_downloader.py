"""
Image downloader service for bulk imports.
Downloads images from URLs and uploads them to Supabase storage.
"""

import asyncio
import hashlib
import io
import logging
import uuid
from typing import Optional
from urllib.parse import urlparse

import httpx
from PIL import Image

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Supported image formats
SUPPORTED_FORMATS = {'jpeg', 'jpg', 'png', 'gif', 'webp'}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
THUMBNAIL_SIZE = (200, 200)
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds


async def download_image(
    source_url: str,
    timeout: float = 30.0,
    retries: int = MAX_RETRIES,
) -> bytes | None:
    """
    Download image from URL with retries.

    Args:
        source_url: URL to download from
        timeout: Request timeout in seconds
        retries: Number of retry attempts

    Returns:
        Image bytes or None if download fails
    """
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
                verify=False,  # Some marketplaces have SSL issues
            ) as client:
                response = await client.get(source_url)
                response.raise_for_status()

                # Check content type
                content_type = response.headers.get('content-type', '').lower()
                if not any(fmt in content_type for fmt in ['image/', 'octet-stream']):
                    logger.warning(f"Invalid content type for {source_url}: {content_type}")
                    return None

                # Check size
                if len(response.content) > MAX_IMAGE_SIZE:
                    logger.warning(f"Image too large from {source_url}: {len(response.content)} bytes")
                    return None

                return response.content

        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP error downloading {source_url}: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.warning(f"Request error downloading {source_url}: {str(e)}")
        except Exception as e:
            logger.warning(f"Error downloading {source_url}: {str(e)}")

        if attempt < retries - 1:
            await asyncio.sleep(RETRY_DELAY * (attempt + 1))

    return None


def validate_image(image_data: bytes) -> tuple[bool, str | None, str | None]:
    """
    Validate image data and detect format.

    Args:
        image_data: Raw image bytes

    Returns:
        Tuple of (is_valid, format, error_message)
    """
    try:
        img = Image.open(io.BytesIO(image_data))
        img_format = img.format.lower() if img.format else None

        if not img_format or img_format not in SUPPORTED_FORMATS:
            return False, None, f"Unsupported format: {img_format}"

        # Verify image can be read
        img.verify()

        return True, img_format, None

    except Exception as e:
        return False, None, f"Invalid image: {str(e)}"


def process_image(
    image_data: bytes,
    max_width: int = 1920,
    max_height: int = 1920,
    quality: int = 85,
    output_format: str = 'webp',
) -> bytes:
    """
    Process image: resize if needed, convert to WebP.

    Args:
        image_data: Raw image bytes
        max_width: Maximum width
        max_height: Maximum height
        quality: Output quality (1-100)
        output_format: Output format

    Returns:
        Processed image bytes
    """
    img = Image.open(io.BytesIO(image_data))

    # Convert to RGB if necessary (for PNG with transparency, etc.)
    if img.mode in ('RGBA', 'P', 'LA'):
        # Create white background for transparency
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Resize if too large
    if img.width > max_width or img.height > max_height:
        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

    # Save to bytes
    output = io.BytesIO()
    img.save(output, format=output_format.upper(), quality=quality, optimize=True)
    return output.getvalue()


def create_thumbnail(
    image_data: bytes,
    size: tuple[int, int] = THUMBNAIL_SIZE,
    quality: int = 80,
) -> bytes:
    """
    Create a thumbnail from image data.

    Args:
        image_data: Raw image bytes
        size: Thumbnail dimensions (width, height)
        quality: Output quality

    Returns:
        Thumbnail image bytes
    """
    img = Image.open(io.BytesIO(image_data))

    # Convert mode
    if img.mode in ('RGBA', 'P', 'LA'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Create thumbnail
    img.thumbnail(size, Image.Resampling.LANCZOS)

    output = io.BytesIO()
    img.save(output, format='WEBP', quality=quality, optimize=True)
    return output.getvalue()


async def upload_to_supabase(
    file_data: bytes,
    bucket: str,
    path: str,
    content_type: str = 'image/webp',
) -> str | None:
    """
    Upload file to Supabase Storage.

    Args:
        file_data: File bytes
        bucket: Storage bucket name
        path: File path within bucket
        content_type: MIME type

    Returns:
        Public URL or None if upload fails
    """
    settings = get_settings()

    try:
        url = f"{settings.supabase_url}/storage/v1/object/{bucket}/{path}"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                content=file_data,
                headers={
                    'Authorization': f'Bearer {settings.supabase_service_role_key}',
                    'Content-Type': content_type,
                    'x-upsert': 'true',
                },
            )

            if response.status_code in (200, 201):
                # Return public URL
                public_url = f"{settings.supabase_url}/storage/v1/object/public/{bucket}/{path}"
                return public_url
            else:
                logger.error(f"Upload failed: {response.status_code} - {response.text}")
                return None

    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return None


def generate_storage_path(
    organization_id: str,
    product_id: str,
    image_type: str,
    extension: str = 'webp',
) -> str:
    """
    Generate storage path for product image.

    Args:
        organization_id: Organization UUID
        product_id: Product UUID
        image_type: 'main', 'gallery', or 'thumbnail'
        extension: File extension

    Returns:
        Storage path
    """
    # Generate unique filename
    unique_id = uuid.uuid4().hex[:8]
    filename = f"{unique_id}.{extension}"

    return f"org-{organization_id}/products/{product_id}/{image_type}/{filename}"


async def download_and_upload_image(
    source_url: str,
    organization_id: str,
    product_id: str,
    image_type: str = 'main',
    create_thumb: bool = True,
) -> tuple[str | None, str | None]:
    """
    Download image from URL and upload to Supabase storage.

    Args:
        source_url: URL to download from
        organization_id: Organization UUID
        product_id: Product UUID
        image_type: 'main' or 'gallery'
        create_thumb: Whether to create and upload thumbnail

    Returns:
        Tuple of (image_url, thumbnail_url)
    """
    # Download
    image_data = await download_image(source_url)
    if not image_data:
        logger.warning(f"Failed to download image: {source_url}")
        return None, None

    # Validate
    is_valid, img_format, error = validate_image(image_data)
    if not is_valid:
        logger.warning(f"Invalid image from {source_url}: {error}")
        return None, None

    # Process main image
    processed = process_image(image_data)

    # Upload main image
    path = generate_storage_path(organization_id, product_id, image_type)
    image_url = await upload_to_supabase(processed, 'org-media', path)

    if not image_url:
        return None, None

    # Create and upload thumbnail if requested
    thumb_url = None
    if create_thumb:
        thumbnail = create_thumbnail(image_data)
        thumb_path = generate_storage_path(organization_id, product_id, 'thumbnails')
        thumb_url = await upload_to_supabase(thumbnail, 'org-media', thumb_path)

    return image_url, thumb_url


async def process_image_queue_item(
    job_id: str,
    item_id: str,
    product_id: str,
    source_url: str,
    target_type: str,
    organization_id: str,
) -> dict:
    """
    Process a single image queue item.

    Args:
        job_id: Import job ID
        item_id: Queue item ID
        product_id: Product UUID
        source_url: Image source URL
        target_type: 'main' or 'gallery'
        organization_id: Organization UUID

    Returns:
        Result dictionary with status and URLs
    """
    try:
        image_url, thumb_url = await download_and_upload_image(
            source_url=source_url,
            organization_id=organization_id,
            product_id=product_id,
            image_type=target_type,
            create_thumb=True,
        )

        if image_url:
            return {
                'status': 'completed',
                'result_url': image_url,
                'thumbnail_url': thumb_url,
                'error_message': None,
            }
        else:
            return {
                'status': 'failed',
                'result_url': None,
                'thumbnail_url': None,
                'error_message': 'Failed to download or upload image',
            }

    except Exception as e:
        logger.error(f"Error processing image queue item {item_id}: {str(e)}")
        return {
            'status': 'failed',
            'result_url': None,
            'thumbnail_url': None,
            'error_message': str(e),
        }


async def process_image_batch(
    items: list[dict],
    organization_id: str,
    concurrency: int = 5,
) -> list[dict]:
    """
    Process multiple images concurrently.

    Args:
        items: List of image queue items
        organization_id: Organization UUID
        concurrency: Max concurrent downloads

    Returns:
        List of results
    """
    semaphore = asyncio.Semaphore(concurrency)

    async def process_with_semaphore(item: dict) -> dict:
        async with semaphore:
            return await process_image_queue_item(
                job_id=item['job_id'],
                item_id=item['id'],
                product_id=item['product_id'],
                source_url=item['source_url'],
                target_type=item['target_type'],
                organization_id=organization_id,
            )

    tasks = [process_with_semaphore(item) for item in items]
    return await asyncio.gather(*tasks)
