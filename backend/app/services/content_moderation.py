"""
Content Moderation Service
Comprehensive moderation queue, AI flagging, and quality control.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.content_moderation import (
    ModerationQueueItem,
    ModerationQueueFilters,
    ContentReport,
    ContentReportCreate,
    ModerationDecision,
    ModerationAppeal,
    ModerationAppealCreate,
    ModeratorNote,
    ModeratorNoteCreate,
    ViolationRecord,
    ModerationStats,
    AIFlagResult,
    AIModerationPattern,
    AIModerationPatternCreate,
    AIModerationPatternUpdate,
    ImageAnalysisResult,
)
from app.services.admin_guard import assert_platform_admin, assert_moderator

logger = logging.getLogger(__name__)


# =============================================================================
# AI AUTO-MODERATION
# =============================================================================

class AIContentModerator:
    """AI-powered content analysis and flagging."""
    
    def __init__(self):
        self._patterns_cache = None
        self._patterns_loaded_at = None
    
    def _load_patterns(self) -> list[dict]:
        """Load active moderation patterns from database."""
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute('''
                    SELECT id, name, pattern_type, pattern_data, detects, 
                           action_on_match, priority_boost, confidence_weight
                    FROM ai_moderation_patterns
                    WHERE is_active = true
                ''')
                return cur.fetchall()
    
    def analyze_text(self, text: str, content_type: str) -> AIFlagResult:
        """Analyze text content for policy violations."""
        patterns = self._load_patterns()
        flags = []
        max_confidence = 0.0
        priority_boost = 0
        
        for pattern in patterns:
            if pattern['pattern_type'] not in ('text_keywords', 'text_regex'):
                continue
                
            pattern_data = pattern['pattern_data']
            matched = False
            
            if pattern['pattern_type'] == 'text_keywords':
                keywords = pattern_data.get('keywords', [])
                case_insensitive = pattern_data.get('case_insensitive', True)
                check_text = text.lower() if case_insensitive else text
                
                for keyword in keywords:
                    check_keyword = keyword.lower() if case_insensitive else keyword
                    if check_keyword in check_text:
                        matched = True
                        break
            
            elif pattern['pattern_type'] == 'text_regex':
                regex = pattern_data.get('regex', '')
                regex_flags = pattern_data.get('flags', '')
                flags_int = re.IGNORECASE if 'i' in regex_flags else 0
                
                try:
                    if re.search(regex, text, flags_int):
                        matched = True
                except re.error:
                    logger.warning(f"Invalid regex pattern: {regex}")
            
            if matched:
                flags.append({
                    'pattern_id': str(pattern['id']),
                    'pattern_name': pattern['name'],
                    'detects': pattern['detects'],
                    'action': pattern['action_on_match'],
                })
                max_confidence = max(max_confidence, float(pattern['confidence_weight']))
                priority_boost = max(priority_boost, pattern['priority_boost'])
        
        return AIFlagResult(
            flags=flags,
            confidence_score=max_confidence if flags else 0.0,
            priority_boost=priority_boost,
            recommended_action='flag_for_review' if flags else None,
        )
    
    def analyze_image(self, image_url: str, content_type: str) -> ImageAnalysisResult:
        """
        Analyze image content for policy violations.

        Currently implements basic pattern matching.
        For production, integrate with external image moderation APIs
        (e.g., AWS Rekognition, Google Vision, Azure Content Moderator).
        """
        patterns = self._load_patterns()
        flags = []
        max_confidence = 0.0
        detected_objects = []
        is_offensive = False
        is_duplicate = False
        duplicate_hash = None

        for pattern in patterns:
            if pattern['pattern_type'] != 'image_hash':
                continue

            # Image hash pattern - check for duplicate/banned images
            pattern_data = pattern['pattern_data']
            banned_hashes = pattern_data.get('banned_hashes', [])

            # In production: compute perceptual hash of the image
            # and compare with banned_hashes
            # For now, we'll check if URL matches known bad patterns
            url_patterns = pattern_data.get('url_patterns', [])
            for url_pattern in url_patterns:
                if url_pattern.lower() in image_url.lower():
                    flags.append({
                        'pattern_id': str(pattern['id']),
                        'pattern_name': pattern['name'],
                        'detects': pattern['detects'],
                        'action': pattern['action_on_match'],
                    })
                    max_confidence = max(max_confidence, float(pattern['confidence_weight']))
                    break

        # Check for offensive content patterns in URL/filename
        offensive_terms = ['nude', 'xxx', 'porn', 'violence', 'gore']
        image_lower = image_url.lower()
        for term in offensive_terms:
            if term in image_lower:
                is_offensive = True
                flags.append({
                    'pattern_id': 'builtin_offensive',
                    'pattern_name': 'Offensive Content Detection',
                    'detects': 'potentially offensive image',
                    'action': 'flag_for_review',
                })
                max_confidence = max(max_confidence, 0.8)
                break

        return ImageAnalysisResult(
            flags=flags,
            confidence_score=max_confidence if flags else 0.0,
            detected_objects=detected_objects,
            detected_text=None,
            is_offensive=is_offensive,
            is_duplicate=is_duplicate,
            duplicate_hash=duplicate_hash,
        )

    def check_for_auto_flag(
        self,
        content_type: str,
        content_id: str,
        text_content: Optional[str] = None,
    ) -> Optional[str]:
        """
        Check content and auto-flag if needed.
        Returns queue item ID if flagged, None otherwise.
        """
        if not text_content:
            return None
        
        result = self.analyze_text(text_content, content_type)
        
        if result.flags:
            # Add to moderation queue
            with get_connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute('''
                        SELECT add_to_moderation_queue(
                            %s, %s::uuid, 'auto_flag',
                            %s::jsonb, %s,
                            %s
                        ) as queue_id
                    ''', (
                        content_type,
                        content_id,
                        json.dumps({'flags': result.flags}),
                        result.confidence_score,
                        [f['detects'] for f in result.flags],
                    ))
                    row = cur.fetchone()
                    conn.commit()
                    return str(row['queue_id']) if row else None
        
        return None


# Global AI moderator instance
ai_moderator = AIContentModerator()


# =============================================================================
# MODERATION QUEUE MANAGEMENT
# =============================================================================

def get_queue_stats(user_id: str) -> ModerationStats:
    """Get moderation queue statistics."""
    assert_moderator(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('''
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                    COUNT(*) FILTER (WHERE status = 'in_review') as in_review_count,
                    COUNT(*) FILTER (WHERE status = 'escalated') as escalated_count,
                    COUNT(*) FILTER (WHERE status = 'appealed') as appealed_count,
                    COUNT(*) FILTER (WHERE resolved_at > now() - interval '24 hours') as resolved_today,
                    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) 
                        FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours
                FROM moderation_queue
            ''')
            stats = cur.fetchone()
            
            # Get counts by content type
            cur.execute('''
                SELECT content_type, COUNT(*) as count
                FROM moderation_queue
                WHERE status = 'pending'
                GROUP BY content_type
            ''')
            by_type = {row['content_type']: row['count'] for row in cur.fetchall()}
            
            return ModerationStats(
                pending_count=stats['pending_count'] or 0,
                in_review_count=stats['in_review_count'] or 0,
                escalated_count=stats['escalated_count'] or 0,
                appealed_count=stats['appealed_count'] or 0,
                resolved_today=stats['resolved_today'] or 0,
                avg_resolution_hours=round(stats['avg_resolution_hours'] or 0, 1),
                pending_by_type=by_type,
            )


def list_queue_items(
    user_id: str,
    filters: ModerationQueueFilters,
) -> tuple[list[ModerationQueueItem], int]:
    """List moderation queue items with filters."""
    assert_moderator(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Build query
            where_clauses = ['1=1']
            params = []
            
            if filters.status:
                where_clauses.append('status = %s')
                params.append(filters.status)
            
            if filters.content_type:
                where_clauses.append('content_type = %s')
                params.append(filters.content_type)
            
            if filters.source:
                where_clauses.append('source = %s')
                params.append(filters.source)
            
            if filters.assigned_to:
                where_clauses.append('assigned_to = %s')
                params.append(filters.assigned_to)
            
            if filters.min_priority:
                where_clauses.append('priority_score >= %s')
                params.append(filters.min_priority)
            
            if filters.escalation_level is not None:
                where_clauses.append('escalation_level = %s')
                params.append(filters.escalation_level)
            
            where_sql = ' AND '.join(where_clauses)
            
            # Count total
            cur.execute(f'SELECT COUNT(*) as total FROM moderation_queue WHERE {where_sql}', params)
            total = cur.fetchone()['total']
            
            # Fetch items
            order_by = 'priority_score DESC, created_at ASC'
            if filters.order_by == 'created_at':
                order_by = 'created_at DESC'
            elif filters.order_by == 'updated_at':
                order_by = 'updated_at DESC'
            
            cur.execute(f'''
                SELECT mq.*, 
                       ap.display_name as assigned_to_name,
                       (SELECT COUNT(*) FROM content_reports cr 
                        WHERE cr.content_type = mq.content_type 
                        AND cr.content_id = mq.content_id) as report_count
                FROM moderation_queue mq
                LEFT JOIN app_profiles ap ON ap.id = mq.assigned_to
                WHERE {where_sql}
                ORDER BY {order_by}
                LIMIT %s OFFSET %s
            ''', params + [filters.limit, filters.offset])
            
            items = []
            for row in cur.fetchall():
                items.append(ModerationQueueItem(
                    id=str(row['id']),
                    content_type=row['content_type'],
                    content_id=str(row['content_id']),
                    content_snapshot=row['content_snapshot'],
                    priority_score=row['priority_score'],
                    priority_reason=row['priority_reason'] or [],
                    status=row['status'],
                    source=row['source'],
                    ai_flags=row['ai_flags'] or {},
                    ai_confidence_score=float(row['ai_confidence_score']) if row['ai_confidence_score'] else None,
                    ai_recommended_action=row['ai_recommended_action'],
                    assigned_to=str(row['assigned_to']) if row['assigned_to'] else None,
                    assigned_to_name=row['assigned_to_name'],
                    assigned_at=row['assigned_at'],
                    escalation_level=row['escalation_level'],
                    report_count=row['report_count'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                ))
            
            return items, total


def get_queue_item(user_id: str, item_id: str) -> ModerationQueueItem:
    """Get a single queue item with full details."""
    assert_moderator(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('''
                SELECT mq.*, 
                       ap.display_name as assigned_to_name,
                       (SELECT COUNT(*) FROM content_reports cr 
                        WHERE cr.content_type = mq.content_type 
                        AND cr.content_id = mq.content_id) as report_count
                FROM moderation_queue mq
                LEFT JOIN app_profiles ap ON ap.id = mq.assigned_to
                WHERE mq.id = %s
            ''', (item_id,))
            
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail='Queue item not found')
            
            return ModerationQueueItem(
                id=str(row['id']),
                content_type=row['content_type'],
                content_id=str(row['content_id']),
                content_snapshot=row['content_snapshot'],
                priority_score=row['priority_score'],
                priority_reason=row['priority_reason'] or [],
                status=row['status'],
                source=row['source'],
                ai_flags=row['ai_flags'] or {},
                ai_confidence_score=float(row['ai_confidence_score']) if row['ai_confidence_score'] else None,
                ai_recommended_action=row['ai_recommended_action'],
                assigned_to=str(row['assigned_to']) if row['assigned_to'] else None,
                assigned_to_name=row['assigned_to_name'],
                assigned_at=row['assigned_at'],
                escalation_level=row['escalation_level'],
                report_count=row['report_count'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
            )


def assign_queue_item(user_id: str, item_id: str, assignee_id: Optional[str] = None) -> ModerationQueueItem:
    """Assign a queue item to a moderator (or self if no assignee specified)."""
    assert_moderator(user_id)
    
    target_assignee = assignee_id or user_id
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('''
                UPDATE moderation_queue
                SET assigned_to = %s,
                    assigned_at = now(),
                    status = CASE WHEN status = 'pending' THEN 'in_review' ELSE status END,
                    updated_at = now()
                WHERE id = %s
                RETURNING id
            ''', (target_assignee, item_id))
            
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail='Queue item not found')
            
            # Log the action
            cur.execute('''
                INSERT INTO moderation_actions 
                (queue_item_id, content_type, content_id, action, action_by, notes)
                SELECT id, content_type, content_id, 'assign', %s, %s
                FROM moderation_queue WHERE id = %s
            ''', (user_id, f'Assigned to {target_assignee}', item_id))
            
            conn.commit()
    
    return get_queue_item(user_id, item_id)


def make_decision(user_id: str, item_id: str, decision: ModerationDecision) -> ModerationQueueItem:
    """Make a moderation decision on a queue item."""
    assert_moderator(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Get current state
            cur.execute('SELECT * FROM moderation_queue WHERE id = %s', (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail='Queue item not found')
            
            new_status = 'resolved'
            if decision.action == 'escalate':
                new_status = 'escalated'
            elif decision.action == 'request_changes':
                new_status = 'pending'  # Goes back to pending after changes
            
            # Update queue item
            cur.execute('''
                UPDATE moderation_queue
                SET status = %s,
                    resolution_action = %s,
                    resolution_notes = %s,
                    resolved_by = %s,
                    resolved_at = CASE WHEN %s = 'resolved' THEN now() ELSE resolved_at END,
                    escalation_level = CASE WHEN %s = 'escalate' 
                                       THEN escalation_level + 1 
                                       ELSE escalation_level END,
                    escalated_by = CASE WHEN %s = 'escalate' THEN %s ELSE escalated_by END,
                    escalated_at = CASE WHEN %s = 'escalate' THEN now() ELSE escalated_at END,
                    escalation_reason = CASE WHEN %s = 'escalate' THEN %s ELSE escalation_reason END,
                    updated_at = now()
                WHERE id = %s
            ''', (
                new_status, decision.action, decision.notes, user_id,
                new_status, decision.action, decision.action, user_id,
                decision.action, decision.action, decision.notes,
                item_id
            ))
            
            # Apply action to actual content
            _apply_content_action(cur, item, decision)
            
            # Log the action
            cur.execute('''
                INSERT INTO moderation_actions 
                (queue_item_id, content_type, content_id, action, action_by, 
                 reason, notes, violation_type, guideline_ref)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                item_id, item['content_type'], str(item['content_id']),
                decision.action, user_id, decision.reason, decision.notes,
                decision.violation_type, decision.guideline_code
            ))
            
            # Record violation if applicable
            if decision.action == 'reject' and decision.violation_type:
                _record_violation(cur, item, decision, user_id)
            
            conn.commit()
    
    return get_queue_item(user_id, item_id)


def _apply_content_action(cur, item: dict, decision: ModerationDecision):
    """Apply moderation decision to the actual content."""
    content_type = item['content_type']
    content_id = item['content_id']
    
    if decision.action == 'approve':
        if content_type == 'organization':
            cur.execute('''
                UPDATE organizations 
                SET verification_status = 'verified', is_verified = true, updated_at = now()
                WHERE id = %s
            ''', (content_id,))
        elif content_type == 'review':
            cur.execute('''
                UPDATE reviews SET status = 'approved', updated_at = now() WHERE id = %s
            ''', (content_id,))
        elif content_type == 'post':
            cur.execute('''
                UPDATE posts SET status = 'published', updated_at = now() WHERE id = %s
            ''', (content_id,))
    
    elif decision.action == 'reject':
        if content_type == 'organization':
            cur.execute('''
                UPDATE organizations 
                SET verification_status = 'rejected', 
                    verification_comment = %s,
                    updated_at = now()
                WHERE id = %s
            ''', (decision.notes, content_id))
        elif content_type == 'review':
            cur.execute('''
                UPDATE reviews 
                SET status = 'rejected', 
                    moderation_comment = %s,
                    updated_at = now() 
                WHERE id = %s
            ''', (decision.notes, content_id))
        elif content_type == 'post':
            cur.execute('''
                UPDATE posts SET status = 'rejected', updated_at = now() WHERE id = %s
            ''', (content_id,))
    
    elif decision.action == 'delete':
        # Soft delete - we don't actually remove data
        if content_type == 'review':
            cur.execute('''
                UPDATE reviews SET status = 'deleted', updated_at = now() WHERE id = %s
            ''', (content_id,))
        elif content_type == 'post':
            cur.execute('''
                UPDATE posts SET status = 'deleted', updated_at = now() WHERE id = %s
            ''', (content_id,))


def _record_violation(cur, item: dict, decision: ModerationDecision, moderator_id: str):
    """Record a violation in the history."""
    # Determine violator
    violator_type = 'organization'
    violator_id = None
    
    content_type = item['content_type']
    content_id = item['content_id']
    
    if content_type == 'organization':
        violator_id = content_id
    elif content_type in ('product', 'review', 'post'):
        cur.execute(f'SELECT organization_id FROM {content_type}s WHERE id = %s', (content_id,))
        row = cur.fetchone()
        if row:
            violator_id = row['organization_id']
    
    if violator_id:
        cur.execute('''
            INSERT INTO violation_history
            (violator_type, violator_id, violation_type, guideline_code, severity,
             content_type, content_id, queue_item_id, consequence, notes, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            violator_type, violator_id, decision.violation_type, decision.guideline_code,
            decision.severity or 'medium', content_type, content_id, item['id'],
            'content_removed', decision.notes, moderator_id
        ))


# =============================================================================
# COMMUNITY REPORTING
# =============================================================================

def create_report(user_id: Optional[str], report: ContentReportCreate) -> ContentReport:
    """Create a community report for content."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Check for duplicate recent reports from same user
            if user_id:
                cur.execute('''
                    SELECT id FROM content_reports
                    WHERE reporter_user_id = %s
                    AND content_type = %s AND content_id = %s
                    AND created_at > now() - interval '24 hours'
                ''', (user_id, report.content_type, report.content_id))
                
                if cur.fetchone():
                    raise HTTPException(
                        status_code=400, 
                        detail='You have already reported this content recently'
                    )
            
            # Create the report
            cur.execute('''
                INSERT INTO content_reports
                (content_type, content_id, reporter_user_id, reason, reason_details, evidence_urls)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
            ''', (
                report.content_type, report.content_id, user_id,
                report.reason, report.reason_details, report.evidence_urls or []
            ))
            row = cur.fetchone()
            
            # Add to moderation queue
            cur.execute('''
                SELECT add_to_moderation_queue(
                    %s, %s::uuid, 'user_report',
                    %s::jsonb, NULL,
                    %s
                )
            ''', (
                report.content_type, report.content_id,
                json.dumps({'report_reason': report.reason}),
                [report.reason]
            ))
            
            conn.commit()
            
            return ContentReport(
                id=str(row['id']),
                content_type=row['content_type'],
                content_id=str(row['content_id']),
                reporter_user_id=str(row['reporter_user_id']) if row['reporter_user_id'] else None,
                reason=row['reason'],
                reason_details=row['reason_details'],
                evidence_urls=row['evidence_urls'] or [],
                status=row['status'],
                created_at=row['created_at'],
            )


def list_reports(
    user_id: str,
    content_type: Optional[str] = None,
    content_id: Optional[str] = None,
    status: Optional[str] = 'new',
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ContentReport], int]:
    """List content reports (moderator only)."""
    assert_moderator(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            where_clauses = ['1=1']
            params = []
            
            if content_type:
                where_clauses.append('content_type = %s')
                params.append(content_type)
            
            if content_id:
                where_clauses.append('content_id = %s')
                params.append(content_id)
            
            if status:
                where_clauses.append('status = %s')
                params.append(status)
            
            where_sql = ' AND '.join(where_clauses)
            
            cur.execute(f'SELECT COUNT(*) as total FROM content_reports WHERE {where_sql}', params)
            total = cur.fetchone()['total']
            
            cur.execute(f'''
                SELECT * FROM content_reports
                WHERE {where_sql}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            ''', params + [limit, offset])
            
            reports = []
            for row in cur.fetchall():
                reports.append(ContentReport(
                    id=str(row['id']),
                    content_type=row['content_type'],
                    content_id=str(row['content_id']),
                    reporter_user_id=str(row['reporter_user_id']) if row['reporter_user_id'] else None,
                    reason=row['reason'],
                    reason_details=row['reason_details'],
                    evidence_urls=row['evidence_urls'] or [],
                    status=row['status'],
                    reviewed_by=str(row['reviewed_by']) if row['reviewed_by'] else None,
                    reviewed_at=row['reviewed_at'],
                    review_notes=row['review_notes'],
                    created_at=row['created_at'],
                ))
            
            return reports, total


# =============================================================================
# APPEAL PROCESS
# =============================================================================

def create_appeal(user_id: str, appeal: ModerationAppealCreate) -> ModerationAppeal:
    """Create an appeal for a moderation decision."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Check if there's a recent appeal for the same content
            cur.execute('''
                SELECT id FROM moderation_appeals
                WHERE appellant_user_id = %s
                AND content_type = %s AND content_id = %s
                AND status IN ('pending', 'under_review')
            ''', (user_id, appeal.content_type, appeal.content_id))
            
            if cur.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail='You already have a pending appeal for this content'
                )
            
            # Get the original queue item
            cur.execute('''
                SELECT id FROM moderation_queue
                WHERE content_type = %s AND content_id = %s
                AND status = 'resolved' AND resolution_action = 'rejected'
                ORDER BY resolved_at DESC LIMIT 1
            ''', (appeal.content_type, appeal.content_id))
            
            queue_item = cur.fetchone()
            
            # Create the appeal
            cur.execute('''
                INSERT INTO moderation_appeals
                (original_queue_item_id, content_type, content_id, appellant_user_id,
                 organization_id, appeal_reason, supporting_evidence, additional_context)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            ''', (
                queue_item['id'] if queue_item else None,
                appeal.content_type, appeal.content_id, user_id,
                appeal.organization_id, appeal.appeal_reason,
                appeal.supporting_evidence or [], appeal.additional_context
            ))
            row = cur.fetchone()
            
            # Add to moderation queue as appeal
            cur.execute('''
                SELECT add_to_moderation_queue(
                    %s, %s::uuid, 'appeal',
                    %s::jsonb, NULL,
                    ARRAY['appeal']
                )
            ''', (
                appeal.content_type, appeal.content_id,
                json.dumps({'appeal_id': str(row['id'])})
            ))
            
            conn.commit()
            
            return ModerationAppeal(
                id=str(row['id']),
                content_type=row['content_type'],
                content_id=str(row['content_id']),
                appellant_user_id=str(row['appellant_user_id']),
                organization_id=str(row['organization_id']) if row['organization_id'] else None,
                appeal_reason=row['appeal_reason'],
                supporting_evidence=row['supporting_evidence'] or [],
                additional_context=row['additional_context'],
                status=row['status'],
                created_at=row['created_at'],
            )


def list_appeals(
    user_id: str,
    status: Optional[str] = 'pending',
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ModerationAppeal], int]:
    """List appeals (moderator only)."""
    assert_moderator(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            where_sql = 'status = %s' if status else '1=1'
            params = [status] if status else []
            
            cur.execute(f'SELECT COUNT(*) as total FROM moderation_appeals WHERE {where_sql}', params)
            total = cur.fetchone()['total']
            
            cur.execute(f'''
                SELECT * FROM moderation_appeals
                WHERE {where_sql}
                ORDER BY created_at ASC
                LIMIT %s OFFSET %s
            ''', params + [limit, offset])
            
            appeals = []
            for row in cur.fetchall():
                appeals.append(ModerationAppeal(
                    id=str(row['id']),
                    content_type=row['content_type'],
                    content_id=str(row['content_id']),
                    appellant_user_id=str(row['appellant_user_id']),
                    organization_id=str(row['organization_id']) if row['organization_id'] else None,
                    appeal_reason=row['appeal_reason'],
                    supporting_evidence=row['supporting_evidence'] or [],
                    additional_context=row['additional_context'],
                    status=row['status'],
                    reviewed_by=str(row['reviewed_by']) if row['reviewed_by'] else None,
                    reviewed_at=row['reviewed_at'],
                    review_decision=row['review_decision'],
                    review_notes=row['review_notes'],
                    created_at=row['created_at'],
                ))
            
            return appeals, total


def decide_appeal(
    user_id: str,
    appeal_id: str,
    decision: str,
    notes: Optional[str] = None,
) -> ModerationAppeal:
    """Make a decision on an appeal."""
    assert_moderator(user_id)
    
    if decision not in ('upheld', 'overturned', 'partially_overturned'):
        raise HTTPException(status_code=400, detail='Invalid decision')
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('''
                UPDATE moderation_appeals
                SET status = %s,
                    reviewed_by = %s,
                    reviewed_at = now(),
                    review_decision = %s,
                    review_notes = %s,
                    updated_at = now()
                WHERE id = %s
                RETURNING *
            ''', (decision, user_id, decision, notes, appeal_id))
            
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail='Appeal not found')
            
            # If overturned, update the original content
            if decision in ('overturned', 'partially_overturned'):
                content_type = row['content_type']
                content_id = row['content_id']
                
                if content_type == 'review':
                    cur.execute('''
                        UPDATE reviews SET status = 'approved', updated_at = now() WHERE id = %s
                    ''', (content_id,))
                elif content_type == 'organization':
                    cur.execute('''
                        UPDATE organizations 
                        SET verification_status = 'pending', updated_at = now() 
                        WHERE id = %s
                    ''', (content_id,))
            
            conn.commit()
            
            return ModerationAppeal(
                id=str(row['id']),
                content_type=row['content_type'],
                content_id=str(row['content_id']),
                appellant_user_id=str(row['appellant_user_id']),
                organization_id=str(row['organization_id']) if row['organization_id'] else None,
                appeal_reason=row['appeal_reason'],
                supporting_evidence=row['supporting_evidence'] or [],
                additional_context=row['additional_context'],
                status=decision,
                reviewed_by=user_id,
                reviewed_at=datetime.now(),
                review_decision=decision,
                review_notes=notes,
                created_at=row['created_at'],
            )


# =============================================================================
# MODERATOR NOTES
# =============================================================================

def add_note(user_id: str, note: ModeratorNoteCreate) -> ModeratorNote:
    """Add a moderator note to a subject."""
    assert_moderator(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('''
                INSERT INTO moderator_notes
                (subject_type, subject_id, note_type, content, attachments, created_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
            ''', (
                note.subject_type, note.subject_id, note.note_type,
                note.content, note.attachments, user_id
            ))
            row = cur.fetchone()
            conn.commit()
            
            return ModeratorNote(
                id=str(row['id']),
                subject_type=row['subject_type'],
                subject_id=str(row['subject_id']),
                note_type=row['note_type'],
                content=row['content'],
                attachments=row['attachments'],
                created_by=str(row['created_by']),
                created_at=row['created_at'],
            )


def get_notes(
    user_id: str,
    subject_type: str,
    subject_id: str,
) -> list[ModeratorNote]:
    """Get all notes for a subject."""
    assert_moderator(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('''
                SELECT mn.*, ap.display_name as author_name
                FROM moderator_notes mn
                LEFT JOIN app_profiles ap ON ap.id = mn.created_by
                WHERE subject_type = %s AND subject_id = %s
                ORDER BY created_at DESC
            ''', (subject_type, subject_id))
            
            notes = []
            for row in cur.fetchall():
                notes.append(ModeratorNote(
                    id=str(row['id']),
                    subject_type=row['subject_type'],
                    subject_id=str(row['subject_id']),
                    note_type=row['note_type'],
                    content=row['content'],
                    attachments=row['attachments'],
                    created_by=str(row['created_by']),
                    author_name=row['author_name'],
                    created_at=row['created_at'],
                ))
            
            return notes


def get_violation_history(
    user_id: str,
    violator_type: str,
    violator_id: str,
) -> list[ViolationRecord]:
    """Get violation history for an organization or user."""
    assert_moderator(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('''
                SELECT vh.*, mg.title_ru as guideline_title
                FROM violation_history vh
                LEFT JOIN moderation_guidelines mg ON mg.code = vh.guideline_code
                WHERE violator_type = %s AND violator_id = %s
                ORDER BY created_at DESC
            ''', (violator_type, violator_id))
            
            violations = []
            for row in cur.fetchall():
                violations.append(ViolationRecord(
                    id=str(row['id']),
                    violator_type=row['violator_type'],
                    violator_id=str(row['violator_id']),
                    violation_type=row['violation_type'],
                    guideline_code=row['guideline_code'],
                    guideline_title=row['guideline_title'],
                    severity=row['severity'],
                    content_type=row['content_type'],
                    content_id=str(row['content_id']) if row['content_id'] else None,
                    consequence=row['consequence'],
                    notes=row['notes'],
                    created_at=row['created_at'],
                ))

            return violations


# =============================================================================
# AI MODERATION PATTERNS
# =============================================================================

def list_patterns(
    user_id: str,
    is_active: Optional[bool] = None,
    pattern_type: Optional[str] = None,
) -> list[AIModerationPattern]:
    """List AI moderation patterns (moderator only)."""
    assert_moderator(user_id)

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            where_clauses = ['1=1']
            params = []

            if is_active is not None:
                where_clauses.append('is_active = %s')
                params.append(is_active)

            if pattern_type:
                where_clauses.append('pattern_type = %s')
                params.append(pattern_type)

            where_sql = ' AND '.join(where_clauses)

            cur.execute(f'''
                SELECT * FROM ai_moderation_patterns
                WHERE {where_sql}
                ORDER BY created_at DESC
            ''', params)

            patterns = []
            for row in cur.fetchall():
                patterns.append(AIModerationPattern(
                    id=str(row['id']),
                    name=row['name'],
                    pattern_type=row['pattern_type'],
                    pattern_data=row['pattern_data'],
                    detects=row['detects'],
                    action_on_match=row['action_on_match'],
                    priority_boost=row['priority_boost'],
                    confidence_weight=float(row['confidence_weight']),
                    is_active=row['is_active'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                    created_by=str(row['created_by']) if row.get('created_by') else None,
                ))

            return patterns


def create_pattern(user_id: str, pattern: AIModerationPatternCreate) -> AIModerationPattern:
    """Create a new AI moderation pattern (admin only)."""
    assert_platform_admin(user_id)

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('''
                INSERT INTO ai_moderation_patterns
                (name, pattern_type, pattern_data, detects, action_on_match,
                 priority_boost, confidence_weight, is_active, created_by)
                VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s)
                RETURNING *
            ''', (
                pattern.name,
                pattern.pattern_type,
                json.dumps(pattern.pattern_data),
                pattern.detects,
                pattern.action_on_match,
                pattern.priority_boost,
                pattern.confidence_weight,
                pattern.is_active,
                user_id,
            ))
            row = cur.fetchone()
            conn.commit()

            return AIModerationPattern(
                id=str(row['id']),
                name=row['name'],
                pattern_type=row['pattern_type'],
                pattern_data=row['pattern_data'],
                detects=row['detects'],
                action_on_match=row['action_on_match'],
                priority_boost=row['priority_boost'],
                confidence_weight=float(row['confidence_weight']),
                is_active=row['is_active'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                created_by=str(row['created_by']) if row.get('created_by') else None,
            )


def update_pattern(
    user_id: str,
    pattern_id: str,
    updates: AIModerationPatternUpdate,
) -> AIModerationPattern:
    """Update an AI moderation pattern (admin only)."""
    assert_platform_admin(user_id)

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Build dynamic update
            set_clauses = ['updated_at = now()']
            params = []

            if updates.name is not None:
                set_clauses.append('name = %s')
                params.append(updates.name)

            if updates.pattern_type is not None:
                set_clauses.append('pattern_type = %s')
                params.append(updates.pattern_type)

            if updates.pattern_data is not None:
                set_clauses.append('pattern_data = %s::jsonb')
                params.append(json.dumps(updates.pattern_data))

            if updates.detects is not None:
                set_clauses.append('detects = %s')
                params.append(updates.detects)

            if updates.action_on_match is not None:
                set_clauses.append('action_on_match = %s')
                params.append(updates.action_on_match)

            if updates.priority_boost is not None:
                set_clauses.append('priority_boost = %s')
                params.append(updates.priority_boost)

            if updates.confidence_weight is not None:
                set_clauses.append('confidence_weight = %s')
                params.append(updates.confidence_weight)

            if updates.is_active is not None:
                set_clauses.append('is_active = %s')
                params.append(updates.is_active)

            set_sql = ', '.join(set_clauses)
            params.append(pattern_id)

            cur.execute(f'''
                UPDATE ai_moderation_patterns
                SET {set_sql}
                WHERE id = %s
                RETURNING *
            ''', params)

            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail='Pattern not found')

            conn.commit()

            return AIModerationPattern(
                id=str(row['id']),
                name=row['name'],
                pattern_type=row['pattern_type'],
                pattern_data=row['pattern_data'],
                detects=row['detects'],
                action_on_match=row['action_on_match'],
                priority_boost=row['priority_boost'],
                confidence_weight=float(row['confidence_weight']),
                is_active=row['is_active'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                created_by=str(row['created_by']) if row.get('created_by') else None,
            )


def get_pattern(user_id: str, pattern_id: str) -> AIModerationPattern:
    """Get a single AI moderation pattern (moderator only)."""
    assert_moderator(user_id)

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('SELECT * FROM ai_moderation_patterns WHERE id = %s', (pattern_id,))
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail='Pattern not found')

            return AIModerationPattern(
                id=str(row['id']),
                name=row['name'],
                pattern_type=row['pattern_type'],
                pattern_data=row['pattern_data'],
                detects=row['detects'],
                action_on_match=row['action_on_match'],
                priority_boost=row['priority_boost'],
                confidence_weight=float(row['confidence_weight']),
                is_active=row['is_active'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                created_by=str(row['created_by']) if row.get('created_by') else None,
            )


# =============================================================================
# USER'S OWN REPORTS
# =============================================================================

def get_my_reports(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ContentReport], int]:
    """Get reports submitted by the current user."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Count total
            cur.execute(
                'SELECT COUNT(*) as total FROM content_reports WHERE reporter_user_id = %s',
                (user_id,)
            )
            total = cur.fetchone()['total']

            # Fetch reports
            cur.execute('''
                SELECT * FROM content_reports
                WHERE reporter_user_id = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            ''', (user_id, limit, offset))

            reports = []
            for row in cur.fetchall():
                reports.append(ContentReport(
                    id=str(row['id']),
                    content_type=row['content_type'],
                    content_id=str(row['content_id']),
                    reporter_user_id=str(row['reporter_user_id']) if row['reporter_user_id'] else None,
                    reason=row['reason'],
                    reason_details=row['reason_details'],
                    evidence_urls=row['evidence_urls'] or [],
                    status=row['status'],
                    linked_queue_item=str(row['linked_queue_item']) if row.get('linked_queue_item') else None,
                    reviewed_by=str(row['reviewed_by']) if row['reviewed_by'] else None,
                    reviewed_at=row['reviewed_at'],
                    review_notes=row['review_notes'],
                    created_at=row['created_at'],
                ))

            return reports, total


# =============================================================================
# ESCALATION HELPER
# =============================================================================

def escalate_queue_item(
    user_id: str,
    item_id: str,
    reason: str,
) -> ModerationQueueItem:
    """Escalate a queue item to a higher level (moderator only)."""
    decision = ModerationDecision(
        action='escalate',
        notes=reason,
    )
    return make_decision(user_id, item_id, decision)
