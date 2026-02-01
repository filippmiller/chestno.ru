"""
Content Moderation API Routes
Comprehensive moderation queue, reports, appeals, and tools.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
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
)
from app.services import content_moderation as moderation_service

router = APIRouter(prefix='/api/moderation/v2', tags=['content-moderation'])


# =============================================================================
# QUEUE MANAGEMENT
# =============================================================================

@router.get('/queue/stats', response_model=ModerationStats)
async def get_queue_stats(
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ModerationStats:
    """Get moderation queue statistics (moderator only)."""
    return await run_in_threadpool(moderation_service.get_queue_stats, current_user_id)


@router.get('/queue', response_model=dict)
async def list_queue_items(
    status: Optional[str] = Query(default='pending'),
    content_type: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    assigned_to: Optional[str] = Query(default=None),
    min_priority: Optional[int] = Query(default=None, ge=0, le=100),
    escalation_level: Optional[int] = Query(default=None, ge=0, le=3),
    order_by: str = Query(default='priority'),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """List moderation queue items with filters (moderator only)."""
    filters = ModerationQueueFilters(
        status=status,
        content_type=content_type,
        source=source,
        assigned_to=assigned_to,
        min_priority=min_priority,
        escalation_level=escalation_level,
        order_by=order_by,
        limit=limit,
        offset=offset,
    )
    items, total = await run_in_threadpool(
        moderation_service.list_queue_items, current_user_id, filters
    )
    return {'items': items, 'total': total}


@router.get('/queue/{item_id}', response_model=ModerationQueueItem)
async def get_queue_item(
    item_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ModerationQueueItem:
    """Get a single queue item with full details (moderator only)."""
    return await run_in_threadpool(
        moderation_service.get_queue_item, current_user_id, item_id
    )


@router.post('/queue/{item_id}/assign', response_model=ModerationQueueItem)
async def assign_queue_item(
    item_id: str,
    assignee_id: Optional[str] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ModerationQueueItem:
    """Assign a queue item to a moderator (moderator only)."""
    return await run_in_threadpool(
        moderation_service.assign_queue_item, current_user_id, item_id, assignee_id
    )


@router.post('/queue/{item_id}/decide', response_model=ModerationQueueItem)
async def make_decision(
    item_id: str,
    decision: ModerationDecision,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ModerationQueueItem:
    """Make a moderation decision on a queue item (moderator only)."""
    return await run_in_threadpool(
        moderation_service.make_decision, current_user_id, item_id, decision
    )


# =============================================================================
# BATCH OPERATIONS
# =============================================================================

@router.post('/queue/batch/approve', response_model=dict)
async def batch_approve(
    item_ids: list[str],
    notes: Optional[str] = None,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """Batch approve multiple queue items (moderator only)."""
    results = []
    decision = ModerationDecision(action='approve', notes=notes)
    
    for item_id in item_ids:
        try:
            item = await run_in_threadpool(
                moderation_service.make_decision, current_user_id, item_id, decision
            )
            results.append({'id': item_id, 'success': True})
        except Exception as e:
            results.append({'id': item_id, 'success': False, 'error': str(e)})
    
    return {
        'processed': len(item_ids),
        'successful': sum(1 for r in results if r['success']),
        'results': results,
    }


@router.post('/queue/batch/reject', response_model=dict)
async def batch_reject(
    item_ids: list[str],
    reason: str,
    notes: Optional[str] = None,
    violation_type: Optional[str] = None,
    guideline_code: Optional[str] = None,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """Batch reject multiple queue items (moderator only)."""
    results = []
    decision = ModerationDecision(
        action='reject',
        reason=reason,
        notes=notes,
        violation_type=violation_type,
        guideline_code=guideline_code,
    )
    
    for item_id in item_ids:
        try:
            item = await run_in_threadpool(
                moderation_service.make_decision, current_user_id, item_id, decision
            )
            results.append({'id': item_id, 'success': True})
        except Exception as e:
            results.append({'id': item_id, 'success': False, 'error': str(e)})
    
    return {
        'processed': len(item_ids),
        'successful': sum(1 for r in results if r['success']),
        'results': results,
    }


# =============================================================================
# COMMUNITY REPORTS
# =============================================================================

@router.post('/reports', response_model=ContentReport)
async def create_report(
    report: ContentReportCreate,
    current_user_id: Optional[str] = Depends(get_current_user_id_from_session),
) -> ContentReport:
    """Create a content report (authenticated users)."""
    return await run_in_threadpool(
        moderation_service.create_report, current_user_id, report
    )


@router.get('/reports', response_model=dict)
async def list_reports(
    content_type: Optional[str] = Query(default=None),
    content_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default='new'),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """List content reports (moderator only)."""
    reports, total = await run_in_threadpool(
        moderation_service.list_reports,
        current_user_id, content_type, content_id, status, limit, offset
    )
    return {'items': reports, 'total': total}


# =============================================================================
# APPEALS
# =============================================================================

@router.post('/appeals', response_model=ModerationAppeal)
async def create_appeal(
    appeal: ModerationAppealCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ModerationAppeal:
    """Create an appeal for rejected content (producers)."""
    return await run_in_threadpool(
        moderation_service.create_appeal, current_user_id, appeal
    )


@router.get('/appeals', response_model=dict)
async def list_appeals(
    status: Optional[str] = Query(default='pending'),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """List appeals (moderator only)."""
    appeals, total = await run_in_threadpool(
        moderation_service.list_appeals, current_user_id, status, limit, offset
    )
    return {'items': appeals, 'total': total}


@router.post('/appeals/{appeal_id}/decide', response_model=ModerationAppeal)
async def decide_appeal(
    appeal_id: str,
    decision: str = Query(..., description='upheld, overturned, or partially_overturned'),
    notes: Optional[str] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ModerationAppeal:
    """Make a decision on an appeal (moderator only)."""
    return await run_in_threadpool(
        moderation_service.decide_appeal, current_user_id, appeal_id, decision, notes
    )


# =============================================================================
# MODERATOR NOTES
# =============================================================================

@router.post('/notes', response_model=ModeratorNote)
async def add_note(
    note: ModeratorNoteCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ModeratorNote:
    """Add a moderator note to a subject (moderator only)."""
    return await run_in_threadpool(
        moderation_service.add_note, current_user_id, note
    )


@router.get('/notes/{subject_type}/{subject_id}', response_model=list[ModeratorNote])
async def get_notes(
    subject_type: str,
    subject_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[ModeratorNote]:
    """Get notes for a subject (moderator only)."""
    return await run_in_threadpool(
        moderation_service.get_notes, current_user_id, subject_type, subject_id
    )


# =============================================================================
# VIOLATION HISTORY
# =============================================================================

@router.get('/violations/{violator_type}/{violator_id}', response_model=list[ViolationRecord])
async def get_violation_history(
    violator_type: str,
    violator_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[ViolationRecord]:
    """Get violation history for an organization or user (moderator only)."""
    return await run_in_threadpool(
        moderation_service.get_violation_history, current_user_id, violator_type, violator_id
    )
