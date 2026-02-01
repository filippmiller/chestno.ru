"""Service layer for verified business response system."""

from datetime import datetime, date, timedelta
from typing import Optional, Any
from uuid import UUID

from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.business_responses import (
    VerificationMethod,
    VerificationStatus,
    DocumentType,
    DocumentStatus,
    TemplateCategory,
    ResponseStatus,
    BadgeLevel,
    VerificationLevel,
    SatisfactionCategory,
    VerificationRequestCreate,
    VerificationRequestResponse,
    VerificationDocumentUpload,
    VerificationDocumentResponse,
    VerificationReview,
    ResponseTemplateCreate,
    ResponseTemplateUpdate,
    ResponseTemplateResponse,
    ResponseHistoryItem,
    DailyMetrics,
    MetricsSummary,
    MetricsResponse,
    AccountabilityScore,
    AccountabilityScoresResponse,
    PublicAccountability,
    SatisfactionRatingCreate,
    SatisfactionRatingResponse,
    SatisfactionSummary,
    PendingReviewItem,
    ResponseDashboard,
)
from app.services.organization_profiles import _require_role


# ============================================
# Business Verification
# ============================================

def create_verification_request(
    organization_id: str,
    user_id: str,
    payload: VerificationRequestCreate,
) -> VerificationRequestResponse:
    """Create a new business verification request."""
    _require_role(None, organization_id, user_id, {'owner', 'admin'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Check for existing pending request
            cur.execute(
                '''
                SELECT id FROM business_verification_requests
                WHERE organization_id = %s AND status NOT IN ('approved', 'rejected')
                ''',
                (organization_id,),
            )
            if cur.fetchone():
                raise ValueError('Active verification request already exists')

            # Create request
            cur.execute(
                '''
                INSERT INTO business_verification_requests
                    (organization_id, requested_by, verification_method, verification_data)
                VALUES (%s, %s, %s, %s)
                RETURNING *
                ''',
                (
                    organization_id,
                    user_id,
                    payload.verification_method.value,
                    payload.verification_data,
                ),
            )
            row = cur.fetchone()
            conn.commit()

            return _serialize_verification_request(row, [])


def get_verification_request(
    organization_id: str,
    user_id: str,
) -> Optional[VerificationRequestResponse]:
    """Get the current verification request for an organization."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor', 'analyst', 'viewer'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT * FROM business_verification_requests
                WHERE organization_id = %s
                ORDER BY created_at DESC
                LIMIT 1
                ''',
                (organization_id,),
            )
            row = cur.fetchone()
            if not row:
                return None

            # Get documents
            cur.execute(
                '''
                SELECT * FROM business_verification_documents
                WHERE request_id = %s
                ORDER BY uploaded_at DESC
                ''',
                (str(row['id']),),
            )
            documents = cur.fetchall()

            return _serialize_verification_request(row, documents)


def upload_verification_document(
    organization_id: str,
    request_id: str,
    user_id: str,
    payload: VerificationDocumentUpload,
) -> VerificationDocumentResponse:
    """Upload a document for verification."""
    _require_role(None, organization_id, user_id, {'owner', 'admin'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Verify request belongs to org
            cur.execute(
                '''
                SELECT id FROM business_verification_requests
                WHERE id = %s AND organization_id = %s
                ''',
                (request_id, organization_id),
            )
            if not cur.fetchone():
                raise ValueError('Verification request not found')

            cur.execute(
                '''
                INSERT INTO business_verification_documents
                    (request_id, document_type, file_url, file_name, file_size, mime_type)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
                ''',
                (
                    request_id,
                    payload.document_type.value,
                    payload.file_url,
                    payload.file_name,
                    payload.file_size,
                    payload.mime_type,
                ),
            )
            row = cur.fetchone()
            conn.commit()

            return _serialize_verification_document(row)


def review_verification_request(
    request_id: str,
    reviewer_id: str,
    payload: VerificationReview,
) -> VerificationRequestResponse:
    """Admin: Review a verification request."""
    # Note: Should check for platform_admin role at API level

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                UPDATE business_verification_requests
                SET status = %s,
                    reviewed_by = %s,
                    reviewed_at = now(),
                    review_notes = %s,
                    rejection_reason = %s,
                    updated_at = now()
                WHERE id = %s
                RETURNING *
                ''',
                (
                    payload.status.value,
                    reviewer_id,
                    payload.review_notes,
                    payload.rejection_reason,
                    request_id,
                ),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError('Verification request not found')

            # If approved, update organization verification level
            if payload.status == VerificationStatus.APPROVED:
                cur.execute(
                    '''
                    UPDATE organizations
                    SET verification_status = 'verified',
                        verification_level = 'standard',
                        verified_at = now(),
                        verification_expires_at = now() + INTERVAL '1 year',
                        updated_at = now()
                    WHERE id = %s
                    ''',
                    (str(row['organization_id']),),
                )

            conn.commit()

            # Get documents
            cur.execute(
                'SELECT * FROM business_verification_documents WHERE request_id = %s',
                (request_id,),
            )
            documents = cur.fetchall()

            return _serialize_verification_request(row, documents)


# ============================================
# Response Templates
# ============================================

def list_response_templates(
    organization_id: str,
    user_id: str,
    category: Optional[TemplateCategory] = None,
    active_only: bool = True,
) -> tuple[list[ResponseTemplateResponse], int]:
    """List response templates for an organization."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor', 'analyst', 'viewer'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            query = '''
                SELECT * FROM response_templates
                WHERE organization_id = %s
            '''
            params = [organization_id]

            if category:
                query += ' AND category = %s'
                params.append(category.value)

            if active_only:
                query += ' AND is_active = true'

            query += ' ORDER BY category, usage_count DESC, name'

            cur.execute(query, params)
            rows = cur.fetchall()

            templates = [_serialize_template(row) for row in rows]
            return templates, len(templates)


def create_response_template(
    organization_id: str,
    user_id: str,
    payload: ResponseTemplateCreate,
) -> ResponseTemplateResponse:
    """Create a new response template."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # If setting as default, unset other defaults in category
            if payload.is_default:
                cur.execute(
                    '''
                    UPDATE response_templates
                    SET is_default = false
                    WHERE organization_id = %s AND category = %s AND is_default = true
                    ''',
                    (organization_id, payload.category.value),
                )

            cur.execute(
                '''
                INSERT INTO response_templates
                    (organization_id, name, description, category, template_text, variables, is_default, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                ''',
                (
                    organization_id,
                    payload.name,
                    payload.description,
                    payload.category.value,
                    payload.template_text,
                    payload.variables,
                    payload.is_default,
                    user_id,
                ),
            )
            row = cur.fetchone()
            conn.commit()

            return _serialize_template(row)


def update_response_template(
    organization_id: str,
    template_id: str,
    user_id: str,
    payload: ResponseTemplateUpdate,
) -> ResponseTemplateResponse:
    """Update a response template."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Build update query
            updates = []
            params = []

            if payload.name is not None:
                updates.append('name = %s')
                params.append(payload.name)
            if payload.description is not None:
                updates.append('description = %s')
                params.append(payload.description)
            if payload.category is not None:
                updates.append('category = %s')
                params.append(payload.category.value)
            if payload.template_text is not None:
                updates.append('template_text = %s')
                params.append(payload.template_text)
            if payload.variables is not None:
                updates.append('variables = %s')
                params.append(payload.variables)
            if payload.is_default is not None:
                updates.append('is_default = %s')
                params.append(payload.is_default)
            if payload.is_active is not None:
                updates.append('is_active = %s')
                params.append(payload.is_active)

            if not updates:
                raise ValueError('No fields to update')

            updates.append('updated_at = now()')
            params.extend([template_id, organization_id])

            cur.execute(
                f'''
                UPDATE response_templates
                SET {', '.join(updates)}
                WHERE id = %s AND organization_id = %s
                RETURNING *
                ''',
                params,
            )
            row = cur.fetchone()
            if not row:
                raise ValueError('Template not found')

            # Handle default flag
            if payload.is_default:
                cur.execute(
                    '''
                    UPDATE response_templates
                    SET is_default = false
                    WHERE organization_id = %s AND category = %s AND id != %s AND is_default = true
                    ''',
                    (organization_id, row['category'], template_id),
                )

            conn.commit()
            return _serialize_template(row)


def delete_response_template(
    organization_id: str,
    template_id: str,
    user_id: str,
) -> bool:
    """Delete a response template."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                DELETE FROM response_templates
                WHERE id = %s AND organization_id = %s
                RETURNING id
                ''',
                (template_id, organization_id),
            )
            if not cur.fetchone():
                raise ValueError('Template not found')

            conn.commit()
            return True


def get_suggested_templates(
    organization_id: str,
    review_rating: int,
    review_body: str,
) -> list[ResponseTemplateResponse]:
    """Get suggested templates based on review content."""
    # Determine category based on rating
    if review_rating >= 4:
        category = 'positive_review'
    elif review_rating == 3:
        category = 'neutral_review'
    else:
        category = 'negative_review'

    # Check for specific issues in review text
    review_lower = review_body.lower()
    specific_category = None

    if any(word in review_lower for word in ['quality', 'defect', 'broken', 'damage', 'poor']):
        specific_category = 'quality_issue'
    elif any(word in review_lower for word in ['delivery', 'shipping', 'late', 'arrived']):
        specific_category = 'delivery_issue'
    elif any(word in review_lower for word in ['service', 'support', 'rude', 'unhelpful']):
        specific_category = 'service_issue'

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            categories = [category]
            if specific_category:
                categories.insert(0, specific_category)
            categories.append('general')

            cur.execute(
                '''
                SELECT * FROM response_templates
                WHERE organization_id = %s
                  AND category = ANY(%s)
                  AND is_active = true
                ORDER BY
                    CASE category
                        WHEN %s THEN 1
                        WHEN %s THEN 2
                        ELSE 3
                    END,
                    is_default DESC,
                    usage_count DESC
                LIMIT 5
                ''',
                (
                    organization_id,
                    categories,
                    specific_category or category,
                    category,
                ),
            )
            rows = cur.fetchall()
            return [_serialize_template(row) for row in rows]


# ============================================
# Response History
# ============================================

def get_response_history(
    organization_id: str,
    review_id: str,
    user_id: str,
) -> list[ResponseHistoryItem]:
    """Get response history for a review."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor', 'analyst', 'viewer'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    h.*,
                    u.full_name as responder_name,
                    t.name as template_name
                FROM review_response_history h
                JOIN reviews r ON r.id = h.review_id
                LEFT JOIN app_users u ON u.id = h.response_by
                LEFT JOIN response_templates t ON t.id = h.template_id
                WHERE h.review_id = %s AND r.organization_id = %s
                ORDER BY h.version DESC
                ''',
                (review_id, organization_id),
            )
            rows = cur.fetchall()
            return [_serialize_response_history(row) for row in rows]


# ============================================
# Response Metrics
# ============================================

def get_response_metrics(
    organization_id: str,
    user_id: str,
    days: int = 30,
) -> MetricsResponse:
    """Get response metrics for the organization."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'analyst'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            start_date = date.today() - timedelta(days=days)

            # Get daily metrics
            cur.execute(
                '''
                SELECT * FROM response_metrics_daily
                WHERE organization_id = %s AND metric_date >= %s
                ORDER BY metric_date DESC
                ''',
                (organization_id, start_date),
            )
            daily_rows = cur.fetchall()

            # Calculate summary
            cur.execute(
                '''
                SELECT
                    COUNT(*) as total_reviews,
                    COUNT(*) FILTER (WHERE response IS NOT NULL) as total_responded,
                    COUNT(*) FILTER (WHERE response IS NULL AND status = 'approved') as pending_reviews,
                    AVG(response_time_hours) FILTER (WHERE response_time_hours IS NOT NULL) as avg_response_time,
                    MAX(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)
                        FILTER (WHERE response IS NULL AND status = 'approved') as oldest_pending_hours,
                    COUNT(*) FILTER (WHERE rating = 1) as rating_1,
                    COUNT(*) FILTER (WHERE rating = 2) as rating_2,
                    COUNT(*) FILTER (WHERE rating = 3) as rating_3,
                    COUNT(*) FILTER (WHERE rating = 4) as rating_4,
                    COUNT(*) FILTER (WHERE rating = 5) as rating_5,
                    COUNT(*) FILTER (WHERE rating = 1 AND response IS NOT NULL) as responded_1,
                    COUNT(*) FILTER (WHERE rating = 2 AND response IS NOT NULL) as responded_2,
                    COUNT(*) FILTER (WHERE rating = 3 AND response IS NOT NULL) as responded_3,
                    COUNT(*) FILTER (WHERE rating = 4 AND response IS NOT NULL) as responded_4,
                    COUNT(*) FILTER (WHERE rating = 5 AND response IS NOT NULL) as responded_5
                FROM reviews
                WHERE organization_id = %s
                  AND created_at >= %s
                  AND status = 'approved'
                ''',
                (organization_id, start_date),
            )
            summary_row = cur.fetchone()

            total = summary_row['total_reviews'] or 0
            responded = summary_row['total_responded'] or 0
            response_rate = (responded / total * 100) if total > 0 else 0

            reviews_by_rating = {
                1: summary_row['rating_1'] or 0,
                2: summary_row['rating_2'] or 0,
                3: summary_row['rating_3'] or 0,
                4: summary_row['rating_4'] or 0,
                5: summary_row['rating_5'] or 0,
            }

            response_rate_by_rating = {}
            for rating in range(1, 6):
                count = reviews_by_rating[rating]
                responded_count = summary_row[f'responded_{rating}'] or 0
                response_rate_by_rating[rating] = (responded_count / count * 100) if count > 0 else 0

            summary = MetricsSummary(
                period_days=days,
                total_reviews=total,
                total_responded=responded,
                response_rate=round(response_rate, 1),
                avg_response_time_hours=float(summary_row['avg_response_time']) if summary_row['avg_response_time'] else None,
                pending_reviews=summary_row['pending_reviews'] or 0,
                oldest_pending_hours=float(summary_row['oldest_pending_hours']) if summary_row['oldest_pending_hours'] else None,
                reviews_by_rating=reviews_by_rating,
                response_rate_by_rating={k: round(v, 1) for k, v in response_rate_by_rating.items()},
            )

            daily = []
            for row in daily_rows:
                total_day = row['total_reviews'] or 0
                responded_day = row['reviews_responded'] or 0
                daily.append(DailyMetrics(
                    metric_date=row['metric_date'],
                    total_reviews=total_day,
                    reviews_responded=responded_day,
                    reviews_pending=row['reviews_pending'] or 0,
                    response_rate=(responded_day / total_day * 100) if total_day > 0 else 0,
                    avg_response_time_hours=float(row['avg_response_time_hours']) if row['avg_response_time_hours'] else None,
                    min_response_time_hours=float(row['min_response_time_hours']) if row['min_response_time_hours'] else None,
                    max_response_time_hours=float(row['max_response_time_hours']) if row['max_response_time_hours'] else None,
                    median_response_time_hours=float(row['median_response_time_hours']) if row['median_response_time_hours'] else None,
                    positive_reviews=row['positive_reviews'] or 0,
                    neutral_reviews=row['neutral_reviews'] or 0,
                    negative_reviews=row['negative_reviews'] or 0,
                    positive_responded=row['positive_responded'] or 0,
                    neutral_responded=row['neutral_responded'] or 0,
                    negative_responded=row['negative_responded'] or 0,
                ))

            return MetricsResponse(summary=summary, daily=daily)


# ============================================
# Accountability Scores
# ============================================

def get_accountability_scores(
    organization_id: str,
    user_id: str,
    months: int = 12,
) -> AccountabilityScoresResponse:
    """Get accountability scores for the organization."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'analyst', 'viewer'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT * FROM business_accountability_scores
                WHERE organization_id = %s
                ORDER BY score_month DESC
                LIMIT %s
                ''',
                (organization_id, months),
            )
            rows = cur.fetchall()

            items = [
                AccountabilityScore(
                    score_month=row['score_month'],
                    response_rate_score=row['response_rate_score'],
                    response_time_score=row['response_time_score'],
                    response_quality_score=row['response_quality_score'],
                    overall_score=row['overall_score'],
                    badge_level=BadgeLevel(row['badge_level']),
                    total_reviews=row['total_reviews'],
                    total_responded=row['total_responded'],
                    avg_response_hours=float(row['avg_response_hours']) if row['avg_response_hours'] else None,
                    calculated_at=row['calculated_at'],
                )
                for row in rows
            ]

            # Determine current badge and trend
            current_badge = items[0].badge_level if items else BadgeLevel.NONE

            if len(items) >= 2:
                recent_avg = sum(i.overall_score for i in items[:3]) / min(3, len(items))
                older_avg = sum(i.overall_score for i in items[3:6]) / min(3, len(items) - 3) if len(items) > 3 else recent_avg

                if recent_avg > older_avg + 5:
                    trend = 'improving'
                elif recent_avg < older_avg - 5:
                    trend = 'declining'
                else:
                    trend = 'stable'
            else:
                trend = 'stable'

            return AccountabilityScoresResponse(
                items=items,
                current_badge=current_badge,
                trend=trend,
            )


def get_public_accountability(organization_id: str) -> Optional[PublicAccountability]:
    """Get public accountability data for an organization."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    o.id as organization_id,
                    o.name as organization_name,
                    o.verification_level,
                    COALESCE(s.badge_level, 'none') as badge_level,
                    COALESCE(s.overall_score, 0) as overall_score,
                    COALESCE(s.total_reviews, 0) as total_reviews,
                    COALESCE(s.total_responded, 0) as total_responded,
                    s.avg_response_hours,
                    COALESCE(s.calculated_at, now()) as last_updated
                FROM organizations o
                LEFT JOIN business_accountability_scores s ON s.organization_id = o.id
                    AND s.score_month = DATE_TRUNC('month', CURRENT_DATE)::date
                WHERE o.id = %s
                  AND o.public_visible = true
                ''',
                (organization_id,),
            )
            row = cur.fetchone()
            if not row:
                return None

            total = row['total_reviews'] or 0
            responded = row['total_responded'] or 0

            return PublicAccountability(
                organization_id=str(row['organization_id']),
                organization_name=row['organization_name'],
                verification_level=VerificationLevel(row['verification_level'] or 'unverified'),
                badge_level=BadgeLevel(row['badge_level']),
                overall_score=row['overall_score'],
                response_rate=(responded / total * 100) if total > 0 else 0,
                avg_response_time_hours=float(row['avg_response_hours']) if row['avg_response_hours'] else None,
                total_reviews_last_month=total,
                last_updated=row['last_updated'],
            )


# ============================================
# Response Satisfaction
# ============================================

def rate_response_satisfaction(
    review_id: str,
    user_id: str,
    payload: SatisfactionRatingCreate,
) -> SatisfactionRatingResponse:
    """Rate the helpfulness of a business response."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Verify user is the review author and response exists
            cur.execute(
                '''
                SELECT id FROM reviews
                WHERE id = %s AND author_user_id = %s AND response IS NOT NULL
                ''',
                (review_id, user_id),
            )
            if not cur.fetchone():
                raise ValueError('Cannot rate this response')

            cur.execute(
                '''
                INSERT INTO response_satisfaction
                    (review_id, user_id, is_helpful, feedback_text, feedback_category)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (review_id, user_id)
                DO UPDATE SET
                    is_helpful = EXCLUDED.is_helpful,
                    feedback_text = EXCLUDED.feedback_text,
                    feedback_category = EXCLUDED.feedback_category,
                    created_at = now()
                RETURNING *
                ''',
                (
                    review_id,
                    user_id,
                    payload.is_helpful,
                    payload.feedback_text,
                    payload.feedback_category.value if payload.feedback_category else None,
                ),
            )
            row = cur.fetchone()
            conn.commit()

            return SatisfactionRatingResponse(
                id=str(row['id']),
                review_id=str(row['review_id']),
                user_id=str(row['user_id']),
                is_helpful=row['is_helpful'],
                feedback_text=row['feedback_text'],
                feedback_category=SatisfactionCategory(row['feedback_category']) if row['feedback_category'] else None,
                created_at=row['created_at'],
            )


def get_satisfaction_summary(
    organization_id: str,
    user_id: str,
    days: int = 30,
) -> SatisfactionSummary:
    """Get satisfaction summary for the organization."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'analyst'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            start_date = date.today() - timedelta(days=days)

            cur.execute(
                '''
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE s.is_helpful = true) as helpful,
                    COUNT(*) FILTER (WHERE s.is_helpful = false) as unhelpful,
                    COUNT(*) FILTER (WHERE s.feedback_category = 'resolved_issue') as resolved_issue,
                    COUNT(*) FILTER (WHERE s.feedback_category = 'appreciated_response') as appreciated_response,
                    COUNT(*) FILTER (WHERE s.feedback_category = 'unprofessional') as unprofessional,
                    COUNT(*) FILTER (WHERE s.feedback_category = 'did_not_address_issue') as did_not_address,
                    COUNT(*) FILTER (WHERE s.feedback_category = 'other') as other
                FROM response_satisfaction s
                JOIN reviews r ON r.id = s.review_id
                WHERE r.organization_id = %s
                  AND s.created_at >= %s
                ''',
                (organization_id, start_date),
            )
            row = cur.fetchone()

            total = row['total'] or 0
            helpful = row['helpful'] or 0

            return SatisfactionSummary(
                total_ratings=total,
                helpful_count=helpful,
                unhelpful_count=row['unhelpful'] or 0,
                helpful_percentage=(helpful / total * 100) if total > 0 else 0,
                category_breakdown={
                    'resolved_issue': row['resolved_issue'] or 0,
                    'appreciated_response': row['appreciated_response'] or 0,
                    'unprofessional': row['unprofessional'] or 0,
                    'did_not_address_issue': row['did_not_address'] or 0,
                    'other': row['other'] or 0,
                },
            )


# ============================================
# Dashboard
# ============================================

def get_response_dashboard(
    organization_id: str,
    user_id: str,
) -> ResponseDashboard:
    """Get complete response dashboard data."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Get organization info
            cur.execute(
                '''
                SELECT verification_level FROM organizations WHERE id = %s
                ''',
                (organization_id,),
            )
            org = cur.fetchone()
            verification_level = VerificationLevel(org['verification_level'] or 'unverified')

            # Get current badge
            cur.execute(
                '''
                SELECT badge_level FROM business_accountability_scores
                WHERE organization_id = %s
                ORDER BY score_month DESC
                LIMIT 1
                ''',
                (organization_id,),
            )
            badge_row = cur.fetchone()
            current_badge = BadgeLevel(badge_row['badge_level']) if badge_row else BadgeLevel.NONE

            # Get metrics summary
            metrics = get_response_metrics(organization_id, user_id, 30)

            # Get pending reviews
            cur.execute(
                '''
                SELECT
                    r.id, r.rating, r.title, r.body, r.created_at,
                    u.full_name as author_name,
                    p.name as product_name,
                    EXTRACT(EPOCH FROM (now() - r.created_at)) / 3600 as hours_pending
                FROM reviews r
                LEFT JOIN app_users u ON u.id = r.author_user_id
                LEFT JOIN products p ON p.id = r.product_id
                WHERE r.organization_id = %s
                  AND r.status = 'approved'
                  AND r.response IS NULL
                ORDER BY r.created_at ASC
                LIMIT 10
                ''',
                (organization_id,),
            )
            pending_rows = cur.fetchall()

            pending_reviews = [
                PendingReviewItem(
                    id=str(row['id']),
                    rating=row['rating'],
                    title=row['title'],
                    body=row['body'][:200] + '...' if len(row['body']) > 200 else row['body'],
                    author_name=row['author_name'],
                    product_name=row['product_name'],
                    created_at=row['created_at'],
                    hours_pending=float(row['hours_pending']),
                    is_urgent=float(row['hours_pending']) > 48,
                )
                for row in pending_rows
            ]

            # Get suggested templates (based on most common pending review rating)
            if pending_reviews:
                most_common_rating = max(set(r.rating for r in pending_reviews), key=lambda x: sum(1 for r in pending_reviews if r.rating == x))
                templates = get_suggested_templates(organization_id, most_common_rating, '')
            else:
                templates, _ = list_response_templates(organization_id, user_id, None, True)
                templates = templates[:5]

            # Get accountability trend
            accountability = get_accountability_scores(organization_id, user_id, 6)

            return ResponseDashboard(
                verification_level=verification_level,
                current_badge=current_badge,
                metrics_summary=metrics.summary,
                pending_reviews=pending_reviews,
                suggested_templates=templates,
                accountability_trend=accountability.trend,
            )


# ============================================
# Helper Functions
# ============================================

def _serialize_verification_request(row: dict, documents: list[dict]) -> VerificationRequestResponse:
    return VerificationRequestResponse(
        id=str(row['id']),
        organization_id=str(row['organization_id']),
        requested_by=str(row['requested_by']),
        verification_method=VerificationMethod(row['verification_method']),
        status=VerificationStatus(row['status']),
        verification_data=row['verification_data'] or {},
        reviewed_by=str(row['reviewed_by']) if row['reviewed_by'] else None,
        reviewed_at=row['reviewed_at'],
        review_notes=row['review_notes'],
        rejection_reason=row['rejection_reason'],
        created_at=row['created_at'],
        updated_at=row['updated_at'],
        expires_at=row['expires_at'],
        documents=[_serialize_verification_document(d) for d in documents],
    )


def _serialize_verification_document(row: dict) -> VerificationDocumentResponse:
    return VerificationDocumentResponse(
        id=str(row['id']),
        request_id=str(row['request_id']),
        document_type=DocumentType(row['document_type']),
        file_url=row['file_url'],
        file_name=row['file_name'],
        file_size=row['file_size'],
        mime_type=row['mime_type'],
        status=DocumentStatus(row['status']),
        review_notes=row['review_notes'],
        uploaded_at=row['uploaded_at'],
        reviewed_at=row['reviewed_at'],
    )


def _serialize_template(row: dict) -> ResponseTemplateResponse:
    return ResponseTemplateResponse(
        id=str(row['id']),
        organization_id=str(row['organization_id']),
        name=row['name'],
        description=row['description'],
        category=TemplateCategory(row['category']),
        template_text=row['template_text'],
        variables=row['variables'] or [],
        usage_count=row['usage_count'],
        last_used_at=row['last_used_at'],
        is_default=row['is_default'],
        is_active=row['is_active'],
        created_by=str(row['created_by']) if row['created_by'] else None,
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )


def _serialize_response_history(row: dict) -> ResponseHistoryItem:
    return ResponseHistoryItem(
        id=str(row['id']),
        review_id=str(row['review_id']),
        response_text=row['response_text'],
        response_by=str(row['response_by']),
        responder_name=row.get('responder_name'),
        template_id=str(row['template_id']) if row['template_id'] else None,
        template_name=row.get('template_name'),
        template_modified=row['template_modified'],
        version=row['version'],
        is_current=row['is_current'],
        edit_reason=row['edit_reason'],
        created_at=row['created_at'],
    )
