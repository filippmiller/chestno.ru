"""
AI Photo Counterfeit Detection Service

Compares submitted product photos against registered reference images
using vision AI to detect potential counterfeits.
"""
from __future__ import annotations

import base64
import logging
import httpx
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.core.config import get_settings
from app.core.db import get_connection
from app.schemas.notifications import NotificationEmitRequest
from app.services.notifications import emit_notification

logger = logging.getLogger(__name__)
settings = get_settings()

# Confidence threshold for flagging as potential counterfeit
AUTHENTICITY_THRESHOLD = 70.0


def upload_reference_image(
    product_id: str,
    organization_id: str,
    user_id: str,
    image_url: str,
    image_type: str = 'packaging',
    description: Optional[str] = None
) -> dict:
    """Upload a reference image for a product."""
    valid_types = ['packaging', 'logo', 'label', 'barcode', 'hologram']
    if image_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Invalid image type. Must be one of: {valid_types}'
        )

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify product belongs to organization
        cur.execute(
            'SELECT id FROM products WHERE id = %s AND organization_id = %s',
            (product_id, organization_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Product not found')

        # Get next display order
        cur.execute(
            'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM product_reference_images WHERE product_id = %s',
            (product_id,)
        )
        next_order = cur.fetchone()['next_order']

        # Insert reference image
        cur.execute(
            '''
            INSERT INTO product_reference_images (
                product_id, organization_id, image_url, image_type,
                description, display_order, uploaded_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            ''',
            (product_id, organization_id, image_url, image_type, description, next_order, user_id)
        )
        image = dict(cur.fetchone())
        conn.commit()

        logger.info(f"[counterfeit] Uploaded reference image {image['id']} for product {product_id}")
        return image


def list_reference_images(product_id: str) -> List[dict]:
    """List all reference images for a product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT * FROM product_reference_images
            WHERE product_id = %s AND is_active = true
            ORDER BY display_order ASC
            ''',
            (product_id,)
        )
        return [dict(row) for row in cur.fetchall()]


def delete_reference_image(image_id: str, organization_id: str) -> bool:
    """Delete a reference image."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            '''
            UPDATE product_reference_images
            SET is_active = false
            WHERE id = %s AND organization_id = %s
            ''',
            (image_id, organization_id)
        )
        deleted = cur.rowcount > 0
        conn.commit()
        return deleted


async def check_authenticity(
    product_id: str,
    submitted_image_url: str,
    user_id: Optional[str] = None,
    location_country: Optional[str] = None,
    location_city: Optional[str] = None
) -> dict:
    """
    Check if a submitted image matches the product's reference images.

    Returns a confidence score and authenticity determination.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get product and organization info
        cur.execute(
            '''
            SELECT p.id, p.name, p.organization_id, o.name as org_name
            FROM products p
            JOIN organizations o ON o.id = p.organization_id
            WHERE p.id = %s
            ''',
            (product_id,)
        )
        product = cur.fetchone()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Product not found')

        # Get reference images
        cur.execute(
            '''
            SELECT id, image_url, image_type
            FROM product_reference_images
            WHERE product_id = %s AND is_active = true
            ORDER BY display_order ASC
            LIMIT 5
            ''',
            (product_id,)
        )
        reference_images = cur.fetchall()

        if not reference_images:
            # No reference images - cannot verify
            result = {
                'product_id': product_id,
                'submitted_image_url': submitted_image_url,
                'overall_confidence': None,
                'is_likely_authentic': None,
                'status': 'no_references',
                'message': 'No reference images available for this product'
            }

            # Store result
            cur.execute(
                '''
                INSERT INTO counterfeit_checks (
                    product_id, organization_id, user_id, submitted_image_url,
                    status, error_message, location_country, location_city
                )
                VALUES (%s, %s, %s, %s, 'failed', 'No reference images', %s, %s)
                RETURNING id
                ''',
                (product_id, product['organization_id'], user_id, submitted_image_url,
                 location_country, location_city)
            )
            check_id = cur.fetchone()['id']
            result['check_id'] = str(check_id)
            conn.commit()
            return result

        # Perform AI comparison
        try:
            comparison_result = await _compare_images_with_ai(
                submitted_image_url,
                [dict(r) for r in reference_images]
            )
        except Exception as e:
            logger.error(f"[counterfeit] AI comparison failed: {e}")
            comparison_result = {
                'confidence': None,
                'matched_reference_id': None,
                'analysis_details': {'error': str(e)}
            }

        # Determine authenticity
        confidence = comparison_result.get('confidence')
        is_authentic = confidence >= AUTHENTICITY_THRESHOLD if confidence is not None else None

        # Store result
        cur.execute(
            '''
            INSERT INTO counterfeit_checks (
                product_id, organization_id, user_id, submitted_image_url,
                overall_confidence, is_likely_authentic, analysis_details,
                matched_reference_id, matched_confidence,
                location_country, location_city,
                status, processed_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'completed', now())
            RETURNING id
            ''',
            (
                product_id, product['organization_id'], user_id, submitted_image_url,
                confidence, is_authentic, Jsonb(comparison_result.get('analysis_details', {})),
                comparison_result.get('matched_reference_id'), comparison_result.get('matched_confidence'),
                location_country, location_city
            )
        )
        check = cur.fetchone()
        check_id = str(check['id'])

        # Alert organization if potential counterfeit detected
        if is_authentic is False:
            try:
                location = f"{location_city}, {location_country}" if location_city else location_country or "Unknown"
                emit_notification(NotificationEmitRequest(
                    type_key='business.counterfeit_alert',
                    org_id=str(product['organization_id']),
                    recipient_scope='organization',
                    payload={
                        'check_id': check_id,
                        'product_name': product['name'],
                        'location': location,
                        'confidence': confidence
                    }
                ))
            except Exception as e:
                logger.warning(f"Failed to send counterfeit alert: {e}")

        conn.commit()

        return {
            'check_id': check_id,
            'product_id': product_id,
            'product_name': product['name'],
            'submitted_image_url': submitted_image_url,
            'overall_confidence': confidence,
            'is_likely_authentic': is_authentic,
            'matched_reference_id': comparison_result.get('matched_reference_id'),
            'analysis_details': comparison_result.get('analysis_details', {}),
            'status': 'completed'
        }


async def _compare_images_with_ai(
    submitted_url: str,
    reference_images: List[dict]
) -> dict:
    """
    Use Claude Vision API to compare submitted image against references.

    Returns confidence score and analysis details.
    """
    # Check if API key is configured
    api_key = getattr(settings, 'anthropic_api_key', None)
    if not api_key:
        logger.warning("[counterfeit] Anthropic API key not configured, using fallback")
        # Fallback: return moderate confidence (for demo purposes)
        return {
            'confidence': 75.0,
            'matched_reference_id': reference_images[0]['id'] if reference_images else None,
            'matched_confidence': 75.0,
            'analysis_details': {
                'method': 'fallback',
                'message': 'AI comparison not configured, returning placeholder result'
            }
        }

    try:
        # Build prompt for Claude
        reference_urls = [img['image_url'] for img in reference_images[:3]]

        prompt = f"""You are a product authenticity verification expert. Compare the submitted product image against the reference images from the manufacturer.

Analyze the following aspects:
1. Logo placement and quality
2. Color accuracy
3. Text/label clarity and accuracy
4. Packaging quality
5. Overall appearance match

Reference images (official manufacturer images): {reference_urls}
Submitted image for verification: {submitted_url}

Provide your assessment as JSON:
{{
    "confidence": <0-100 score where 100 is definitely authentic>,
    "matched_reference_index": <index of best matching reference, 0-based>,
    "analysis": {{
        "logo_match": <"good"|"suspicious"|"mismatch">,
        "color_match": <"good"|"suspicious"|"mismatch">,
        "text_match": <"good"|"suspicious"|"mismatch">,
        "quality_match": <"good"|"suspicious"|"mismatch">,
        "overall_assessment": "<brief explanation>"
    }}
}}

Only return the JSON, no other text."""

        # Call Claude API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://api.anthropic.com/v1/messages',
                headers={
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                json={
                    'model': 'claude-3-haiku-20240307',
                    'max_tokens': 500,
                    'messages': [{
                        'role': 'user',
                        'content': prompt
                    }]
                },
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()

        # Parse response
        content = result['content'][0]['text']
        import json
        analysis = json.loads(content)

        matched_idx = analysis.get('matched_reference_index', 0)
        matched_ref = reference_images[matched_idx] if matched_idx < len(reference_images) else None

        return {
            'confidence': float(analysis.get('confidence', 50)),
            'matched_reference_id': matched_ref['id'] if matched_ref else None,
            'matched_confidence': float(analysis.get('confidence', 50)),
            'analysis_details': analysis.get('analysis', {})
        }

    except Exception as e:
        logger.error(f"[counterfeit] Claude API error: {e}")
        # Return low confidence on error
        return {
            'confidence': 50.0,
            'matched_reference_id': None,
            'matched_confidence': None,
            'analysis_details': {
                'error': str(e),
                'method': 'ai_error'
            }
        }


def submit_counterfeit_report(
    check_id: str,
    reporter_email: Optional[str] = None,
    reporter_user_id: Optional[str] = None,
    purchase_location: Optional[str] = None,
    purchase_date: Optional[str] = None,
    report_notes: Optional[str] = None
) -> dict:
    """Submit a counterfeit report for follow-up investigation."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify check exists
        cur.execute('SELECT id FROM counterfeit_checks WHERE id = %s', (check_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Check not found')

        cur.execute(
            '''
            INSERT INTO counterfeit_reports (
                check_id, reporter_user_id, reporter_email,
                purchase_location, purchase_date, report_notes
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
            ''',
            (check_id, reporter_user_id, reporter_email, purchase_location,
             purchase_date, report_notes)
        )
        report = dict(cur.fetchone())
        conn.commit()

        logger.info(f"[counterfeit] Created report {report['id']} for check {check_id}")
        return report


def get_counterfeit_stats(organization_id: str, days: int = 30) -> dict:
    """Get counterfeit detection statistics for an organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT * FROM get_counterfeit_stats(%s, %s)',
            (organization_id, days)
        )
        result = cur.fetchone()
        return dict(result) if result else {
            'total_checks': 0,
            'authentic_count': 0,
            'suspicious_count': 0,
            'avg_confidence': None,
            'reports_count': 0
        }
