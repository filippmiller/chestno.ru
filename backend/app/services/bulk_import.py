"""
Bulk import orchestration service.
Manages import jobs, validation, and product creation.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException, UploadFile, status
from psycopg.rows import dict_row
from slugify import slugify

from app.core.db import get_connection
from app.schemas.bulk_import import (
    FieldMapping,
    ImportJob,
    ImportJobCreate,
    ImportJobSettings,
    ImportJobSummary,
    ImportPreviewResponse,
    ImportPreviewRow,
    ImportProgressResponse,
    ImportResultResponse,
    PRODUCT_TARGET_FIELDS,
    SourceColumnInfo,
    FieldMappingInfo,
    ValidationError,
)
from app.services.import_parsers import get_parser

logger = logging.getLogger(__name__)

EDITOR_ROLES = ('owner', 'admin', 'manager', 'editor')
VIEWER_ROLES = EDITOR_ROLES + ('analyst', 'viewer')

# Temp directory for uploaded files
UPLOAD_DIR = tempfile.gettempdir()


def _require_role(cur, organization_id: str, user_id: str, allowed_roles) -> str:
    """Check user role in organization."""
    cur.execute(
        '''
        SELECT role FROM organization_members
        WHERE organization_id = %s AND user_id = %s
        ''',
        (organization_id, user_id),
    )
    row = cur.fetchone()
    if not row or row['role'] not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Недостаточно прав для импорта товаров',
        )
    return row['role']


def _get_job(cur, job_id: str, organization_id: str) -> dict:
    """Get import job by ID."""
    cur.execute(
        '''
        SELECT * FROM import_jobs
        WHERE id = %s AND organization_id = %s
        ''',
        (job_id, organization_id),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Задание импорта не найдено',
        )
    return row


def create_import_job(
    organization_id: str,
    user_id: str,
    file: UploadFile,
    source_type: str,
) -> ImportJob:
    """
    Create a new import job from uploaded file.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)

        # Save uploaded file
        job_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename or '')[1].lower()
        temp_path = os.path.join(UPLOAD_DIR, f"import_{job_id}{ext}")

        content = file.file.read()
        with open(temp_path, 'wb') as f:
            f.write(content)

        # Validate file with parser
        parser = get_parser(source_type)
        is_valid, error = parser.validate_file(temp_path)

        if not is_valid:
            os.unlink(temp_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'Некорректный файл: {error}',
            )

        # Count rows
        total_rows = parser.count_rows(temp_path)

        # Create job record
        cur.execute(
            '''
            INSERT INTO import_jobs (
                id, organization_id, created_by, source_type, source_filename,
                status, total_rows
            )
            VALUES (%s, %s, %s, %s, %s, 'pending', %s)
            RETURNING *
            ''',
            (job_id, organization_id, user_id, source_type, file.filename, total_rows),
        )
        row = cur.fetchone()
        conn.commit()

        return ImportJob(**row)


def get_import_job(organization_id: str, job_id: str, user_id: str) -> ImportJob:
    """Get import job details."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, VIEWER_ROLES)
        row = _get_job(cur, job_id, organization_id)
        return ImportJob(**row)


def list_import_jobs(
    organization_id: str,
    user_id: str,
    limit: int = 20,
    offset: int = 0,
) -> list[ImportJobSummary]:
    """List import jobs for organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, VIEWER_ROLES)

        cur.execute(
            '''
            SELECT id, source_type, source_filename, status,
                   total_rows, processed_rows, successful_rows, failed_rows, created_at
            FROM import_jobs
            WHERE organization_id = %s
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            ''',
            (organization_id, limit, offset),
        )
        rows = cur.fetchall()
        return [ImportJobSummary(**row) for row in rows]


def get_field_mapping_info(
    organization_id: str,
    job_id: str,
    user_id: str,
) -> FieldMappingInfo:
    """Get field mapping information for a job."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)
        job = _get_job(cur, job_id, organization_id)

        # Get file path
        ext = os.path.splitext(job['source_filename'] or '')[1].lower()
        temp_path = os.path.join(UPLOAD_DIR, f"import_{job_id}{ext}")

        if not os.path.exists(temp_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Файл импорта не найден. Загрузите заново.',
            )

        # Parse file
        parser = get_parser(job['source_type'])
        columns = parser.get_columns(temp_path)
        samples = parser.get_sample_values(temp_path, max_samples=3)

        # Build column info
        source_columns = []
        for col in columns:
            col_samples = samples.get(col, [])
            source_columns.append(SourceColumnInfo(
                name=col,
                sample_values=[str(v)[:50] for v in col_samples],
                non_empty_count=len(col_samples),
            ))

        # Get suggested mapping
        suggested = parser.get_suggested_mapping()

        # Match columns to suggestions
        suggested_mapping = {}
        for col in columns:
            col_lower = col.lower().strip()
            if col_lower in suggested:
                suggested_mapping[col] = suggested[col_lower]

        return FieldMappingInfo(
            source_columns=source_columns,
            target_fields=PRODUCT_TARGET_FIELDS,
            suggested_mapping=suggested_mapping,
            current_mapping=job.get('field_mapping') or {},
        )


def save_field_mapping(
    organization_id: str,
    job_id: str,
    user_id: str,
    mapping: FieldMapping,
) -> ImportJob:
    """Save field mapping for import job."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)
        _get_job(cur, job_id, organization_id)

        cur.execute(
            '''
            UPDATE import_jobs
            SET field_mapping = %s, status = 'mapping', updated_at = now()
            WHERE id = %s AND organization_id = %s
            RETURNING *
            ''',
            (json.dumps(mapping.mapping), job_id, organization_id),
        )
        row = cur.fetchone()
        conn.commit()

        return ImportJob(**row)


def validate_import(
    organization_id: str,
    job_id: str,
    user_id: str,
) -> ImportJob:
    """Run validation on import data."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)
        job = _get_job(cur, job_id, organization_id)

        # Get file path
        ext = os.path.splitext(job['source_filename'] or '')[1].lower()
        temp_path = os.path.join(UPLOAD_DIR, f"import_{job_id}{ext}")

        if not os.path.exists(temp_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Файл импорта не найден',
            )

        # Parse and validate
        parser = get_parser(job['source_type'])
        mapping = job.get('field_mapping') or {}

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Сначала настройте сопоставление полей',
            )

        validation_errors = []
        row_num = 0

        for raw_row in parser.iter_rows(temp_path):
            row_num += 1

            # Apply mapping
            mapped = apply_mapping(raw_row, mapping)

            # Validate required fields
            if not mapped.get('name'):
                validation_errors.append({
                    'row_number': row_num,
                    'field': 'name',
                    'message': 'Название товара обязательно',
                })

            # Validate price if provided
            price = mapped.get('price')
            if price is not None:
                try:
                    price_val = parse_price(price)
                    if price_val is not None and price_val < 0:
                        validation_errors.append({
                            'row_number': row_num,
                            'field': 'price',
                            'message': 'Цена не может быть отрицательной',
                        })
                except (ValueError, TypeError):
                    validation_errors.append({
                        'row_number': row_num,
                        'field': 'price',
                        'message': 'Некорректное значение цены',
                    })

        # Update job status
        new_status = 'preview' if len(validation_errors) < job['total_rows'] else 'failed'

        cur.execute(
            '''
            UPDATE import_jobs
            SET status = %s, validation_errors = %s, updated_at = now()
            WHERE id = %s AND organization_id = %s
            RETURNING *
            ''',
            (new_status, json.dumps(validation_errors[:100]), job_id, organization_id),
        )
        row = cur.fetchone()
        conn.commit()

        return ImportJob(**row)


def get_import_preview(
    organization_id: str,
    job_id: str,
    user_id: str,
    limit: int = 20,
    offset: int = 0,
) -> ImportPreviewResponse:
    """Get preview of mapped import data."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, VIEWER_ROLES)
        job = _get_job(cur, job_id, organization_id)

        # Get file path
        ext = os.path.splitext(job['source_filename'] or '')[1].lower()
        temp_path = os.path.join(UPLOAD_DIR, f"import_{job_id}{ext}")

        if not os.path.exists(temp_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Файл импорта не найден',
            )

        parser = get_parser(job['source_type'])
        columns = parser.get_columns(temp_path)
        mapping = job.get('field_mapping') or {}

        rows = []
        row_num = 0
        validation_summary = {'valid': 0, 'invalid': 0, 'warnings': 0}

        for raw_row in parser.iter_rows(temp_path):
            row_num += 1

            if row_num <= offset:
                continue
            if len(rows) >= limit:
                break

            mapped = apply_mapping(raw_row, mapping)
            errors = validate_row(mapped, row_num)

            if errors:
                validation_summary['invalid'] += 1
            else:
                validation_summary['valid'] += 1

            rows.append(ImportPreviewRow(
                row_number=row_num,
                raw_data=raw_row,
                mapped_data=mapped,
                errors=errors,
                is_valid=len(errors) == 0,
            ))

        return ImportPreviewResponse(
            job_id=job_id,
            source_type=job['source_type'],
            total_rows=job['total_rows'],
            rows=rows,
            columns=columns,
            suggested_mapping=mapping,
            validation_summary=validation_summary,
        )


def execute_import(
    organization_id: str,
    job_id: str,
    user_id: str,
    settings: ImportJobSettings,
) -> ImportProgressResponse:
    """Start executing the import."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)
        job = _get_job(cur, job_id, organization_id)

        if job['status'] not in ('preview', 'mapping'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Импорт уже запущен или завершён',
            )

        # Update job settings and status
        cur.execute(
            '''
            UPDATE import_jobs
            SET status = 'processing',
                skip_duplicates = %s,
                update_existing = %s,
                download_images = %s,
                started_at = now(),
                updated_at = now()
            WHERE id = %s AND organization_id = %s
            RETURNING *
            ''',
            (
                settings.skip_duplicates,
                settings.update_existing,
                settings.download_images,
                job_id,
                organization_id,
            ),
        )
        conn.commit()

        # Process in background (for now, synchronous)
        result = _process_import(job_id, organization_id, user_id)

        return result


def _process_import(
    job_id: str,
    organization_id: str,
    user_id: str,
) -> ImportProgressResponse:
    """Process import job (synchronous for now)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT * FROM import_jobs WHERE id = %s',
            (job_id,),
        )
        job = cur.fetchone()

        ext = os.path.splitext(job['source_filename'] or '')[1].lower()
        temp_path = os.path.join(UPLOAD_DIR, f"import_{job_id}{ext}")

        if not os.path.exists(temp_path):
            cur.execute(
                '''
                UPDATE import_jobs
                SET status = 'failed', error_message = 'Файл не найден', updated_at = now()
                WHERE id = %s
                ''',
                (job_id,),
            )
            conn.commit()
            raise HTTPException(status_code=404, detail='Файл не найден')

        parser = get_parser(job['source_type'])
        mapping = job.get('field_mapping') or {}

        processed = 0
        successful = 0
        failed = 0
        created_products = []
        image_queue = []

        for raw_row in parser.iter_rows(temp_path):
            processed += 1

            try:
                mapped = apply_mapping(raw_row, mapping)
                errors = validate_row(mapped, processed)

                if errors:
                    failed += 1
                    continue

                # Create product
                product_id = create_product_from_import(
                    cur, organization_id, user_id, mapped, job
                )

                if product_id:
                    successful += 1
                    created_products.append(product_id)

                    # Queue images for download
                    if job['download_images']:
                        main_url = mapped.get('main_image_url')
                        if main_url:
                            image_queue.append({
                                'job_id': job_id,
                                'product_id': product_id,
                                'source_url': main_url,
                                'target_type': 'main',
                            })

                        gallery_urls = mapped.get('gallery_urls', [])
                        if isinstance(gallery_urls, str):
                            gallery_urls = [u.strip() for u in gallery_urls.split(';') if u.strip()]

                        for i, url in enumerate(gallery_urls[:10]):  # Limit to 10 gallery images
                            image_queue.append({
                                'job_id': job_id,
                                'product_id': product_id,
                                'source_url': url,
                                'target_type': 'gallery',
                                'display_order': i,
                            })
                else:
                    failed += 1

            except Exception as e:
                logger.error(f"Error processing row {processed}: {str(e)}")
                failed += 1

            # Update progress periodically
            if processed % 50 == 0:
                cur.execute(
                    '''
                    UPDATE import_jobs
                    SET processed_rows = %s, successful_rows = %s, failed_rows = %s, updated_at = now()
                    WHERE id = %s
                    ''',
                    (processed, successful, failed, job_id),
                )
                conn.commit()

        # Queue images
        for img in image_queue:
            cur.execute(
                '''
                INSERT INTO import_image_queue (job_id, product_id, source_url, target_type, display_order)
                VALUES (%s, %s, %s, %s, %s)
                ''',
                (img['job_id'], img['product_id'], img['source_url'], img['target_type'], img.get('display_order', 0)),
            )

        # Finalize job
        cur.execute(
            '''
            UPDATE import_jobs
            SET status = 'completed',
                processed_rows = %s,
                successful_rows = %s,
                failed_rows = %s,
                completed_at = now(),
                updated_at = now()
            WHERE id = %s
            RETURNING *
            ''',
            (processed, successful, failed, job_id),
        )
        job = cur.fetchone()
        conn.commit()

        # Cleanup temp file
        try:
            os.unlink(temp_path)
        except Exception:
            pass

        return ImportProgressResponse(
            job_id=job_id,
            status=job['status'],
            total_rows=job['total_rows'],
            processed_rows=processed,
            successful_rows=successful,
            failed_rows=failed,
            percentage=100.0,
        )


def cancel_import(
    organization_id: str,
    job_id: str,
    user_id: str,
) -> ImportJob:
    """Cancel an import job."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)
        job = _get_job(cur, job_id, organization_id)

        if job['status'] in ('completed', 'failed', 'cancelled'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Импорт уже завершён',
            )

        cur.execute(
            '''
            UPDATE import_jobs
            SET status = 'cancelled', updated_at = now()
            WHERE id = %s AND organization_id = %s
            RETURNING *
            ''',
            (job_id, organization_id),
        )
        row = cur.fetchone()
        conn.commit()

        # Cleanup temp file
        ext = os.path.splitext(job['source_filename'] or '')[1].lower()
        temp_path = os.path.join(UPLOAD_DIR, f"import_{job_id}{ext}")
        try:
            os.unlink(temp_path)
        except Exception:
            pass

        return ImportJob(**row)


# Helper functions

def apply_mapping(raw_row: dict[str, Any], mapping: dict[str, str]) -> dict[str, Any]:
    """Apply field mapping to a raw row."""
    mapped = {}
    for source_col, target_field in mapping.items():
        if source_col in raw_row:
            mapped[target_field] = raw_row[source_col]
    return mapped


def validate_row(mapped: dict[str, Any], row_number: int) -> list[str]:
    """Validate a mapped row and return error messages."""
    errors = []

    if not mapped.get('name'):
        errors.append('Название товара обязательно')

    price = mapped.get('price')
    if price is not None:
        try:
            price_val = parse_price(price)
            if price_val is not None and price_val < 0:
                errors.append('Цена не может быть отрицательной')
        except (ValueError, TypeError):
            errors.append('Некорректное значение цены')

    return errors


def parse_price(value: Any) -> int | None:
    """Parse price value to cents."""
    if value is None:
        return None

    try:
        if isinstance(value, str):
            clean = value.replace(' ', '').replace('\xa0', '')
            clean = clean.replace('₽', '').replace('руб', '').replace('р', '')
            clean = clean.replace(',', '.')
            value = float(clean)
        return int(float(value) * 100)
    except (ValueError, TypeError):
        return None


def create_product_from_import(
    cur,
    organization_id: str,
    user_id: str,
    mapped: dict[str, Any],
    job: dict,
) -> str | None:
    """Create a product from mapped import data."""
    try:
        name = str(mapped.get('name', '')).strip()
        if not name:
            return None

        # Generate slug
        base_slug = mapped.get('slug') or slugify(name, lowercase=True)
        slug = base_slug

        # Check for duplicates
        cur.execute(
            'SELECT id, sku FROM products WHERE organization_id = %s AND slug = %s',
            (organization_id, slug),
        )
        existing = cur.fetchone()

        if existing:
            if job.get('skip_duplicates', True) and not job.get('update_existing', False):
                return None

            if job.get('update_existing', False):
                # Update existing product
                return update_product_from_import(cur, existing['id'], user_id, mapped)

            # Make slug unique
            slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        # Parse price
        price_cents = parse_price(mapped.get('price'))

        # Insert product
        cur.execute(
            '''
            INSERT INTO products (
                id, organization_id, slug, name, short_description, long_description,
                category, tags, price_cents, currency, status, is_featured,
                main_image_url, gallery, external_url, sku, barcode, stock_quantity,
                created_by, updated_by
            )
            VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s,
                %s, %s, %s, COALESCE(%s, 'RUB'), 'draft', false,
                %s, %s, %s, %s, %s, %s,
                %s, %s
            )
            RETURNING id
            ''',
            (
                organization_id,
                slug,
                name,
                mapped.get('short_description'),
                mapped.get('long_description'),
                mapped.get('category'),
                mapped.get('tags'),
                price_cents,
                mapped.get('currency'),
                None,  # main_image_url - will be set by image downloader
                None,  # gallery
                mapped.get('external_url'),
                mapped.get('sku'),
                mapped.get('barcode'),
                int(mapped.get('stock_quantity') or 0) if mapped.get('stock_quantity') else 0,
                user_id,
                user_id,
            ),
        )
        row = cur.fetchone()
        return str(row['id']) if row else None

    except Exception as e:
        logger.error(f"Error creating product: {str(e)}")
        return None


def update_product_from_import(
    cur,
    product_id: str,
    user_id: str,
    mapped: dict[str, Any],
) -> str | None:
    """Update an existing product from mapped import data."""
    try:
        updates = []
        params = []

        if mapped.get('name'):
            updates.append('name = %s')
            params.append(mapped['name'])

        if mapped.get('short_description'):
            updates.append('short_description = %s')
            params.append(mapped['short_description'])

        if mapped.get('long_description'):
            updates.append('long_description = %s')
            params.append(mapped['long_description'])

        if mapped.get('price') is not None:
            price_cents = parse_price(mapped['price'])
            if price_cents is not None:
                updates.append('price_cents = %s')
                params.append(price_cents)

        if mapped.get('stock_quantity') is not None:
            updates.append('stock_quantity = %s')
            params.append(int(mapped['stock_quantity']))

        if mapped.get('sku'):
            updates.append('sku = %s')
            params.append(mapped['sku'])

        if mapped.get('barcode'):
            updates.append('barcode = %s')
            params.append(mapped['barcode'])

        if not updates:
            return product_id

        updates.append('updated_by = %s')
        params.append(user_id)

        updates.append('updated_at = now()')

        params.append(product_id)

        cur.execute(
            f'''
            UPDATE products
            SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id
            ''',
            params,
        )
        row = cur.fetchone()
        return str(row['id']) if row else None

    except Exception as e:
        logger.error(f"Error updating product: {str(e)}")
        return None
