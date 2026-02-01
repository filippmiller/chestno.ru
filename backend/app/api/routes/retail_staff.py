"""
Retail Staff API Routes.

Endpoints for staff management, training modules, progress tracking, and certification.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.core.session_deps import get_current_user_id_from_session
from app.schemas.staff_training import (
    AssistedScanCreate,
    AssistedScanResponse,
    CertificationStatus,
    QuizSubmitRequest,
    QuizResult,
    RetailStaffCreate,
    RetailStaffListResponse,
    RetailStaffResponse,
    StaffLeaderboardResponse,
    StaffLeaderboardEntry,
    TrainingModuleListResponse,
    TrainingModuleResponse,
    TrainingProgressListResponse,
    TrainingProgressResponse,
    TrainingProgressUpdate,
)

router = APIRouter(prefix='/api/staff', tags=['staff-training'])
store_staff_router = APIRouter(prefix='/api/retail/stores', tags=['store-staff'])

# Certification validity in days
CERTIFICATION_VALIDITY_DAYS = 365


# ==================== Training Modules ====================

@router.get('/training/modules', response_model=TrainingModuleListResponse)
async def list_training_modules(
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> TrainingModuleListResponse:
    """
    List all available training modules.

    Returns modules with user's progress if they are registered as staff.
    """
    def _list_modules():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get staff record if exists
            cur.execute(
                "SELECT id FROM retail_staff WHERE user_id = %s LIMIT 1",
                (current_user_id,),
            )
            staff = cur.fetchone()
            staff_id = staff['id'] if staff else None

            # Get all active modules
            cur.execute(
                """
                SELECT * FROM staff_training_modules
                WHERE is_active = true
                ORDER BY prerequisite_module_id NULLS FIRST, created_at
                """
            )
            modules = [dict(r) for r in cur.fetchall()]

            # Get user progress if staff
            progress_map = {}
            if staff_id:
                cur.execute(
                    """
                    SELECT * FROM staff_training_progress
                    WHERE staff_id = %s
                    """,
                    (staff_id,),
                )
                for p in cur.fetchall():
                    progress_map[str(p['module_id'])] = dict(p)

            # Combine modules with progress
            result_modules = []
            for m in modules:
                m_id = str(m['id'])
                module_resp = TrainingModuleResponse(
                    id=m_id,
                    title=m['title'],
                    description=m['description'],
                    duration_minutes=m['duration_minutes'],
                    content_type=m['content_type'],
                    content_url=m.get('content_url'),
                    content_data=m.get('content_data'),
                    prerequisite_module_id=str(m['prerequisite_module_id']) if m.get('prerequisite_module_id') else None,
                    passing_score=m['passing_score'],
                    is_active=m['is_active'],
                    created_at=m['created_at'],
                    updated_at=m['updated_at'],
                    user_progress=progress_map.get(m_id),
                )
                result_modules.append(module_resp)

            return TrainingModuleListResponse(
                modules=result_modules,
                total=len(result_modules),
            )

    return await run_in_threadpool(_list_modules)


@router.get('/training/modules/{module_id}', response_model=TrainingModuleResponse)
async def get_training_module(
    module_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> TrainingModuleResponse:
    """Get details of a specific training module including content."""
    def _get_module():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT * FROM staff_training_modules WHERE id = %s",
                (module_id,),
            )
            module = cur.fetchone()
            if not module:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Module not found",
                )

            # Get user progress
            cur.execute(
                """
                SELECT stp.* FROM staff_training_progress stp
                JOIN retail_staff rs ON rs.id = stp.staff_id
                WHERE rs.user_id = %s AND stp.module_id = %s
                """,
                (current_user_id, module_id),
            )
            progress = cur.fetchone()

            return TrainingModuleResponse(
                id=str(module['id']),
                title=module['title'],
                description=module['description'],
                duration_minutes=module['duration_minutes'],
                content_type=module['content_type'],
                content_url=module.get('content_url'),
                content_data=module.get('content_data'),
                prerequisite_module_id=str(module['prerequisite_module_id']) if module.get('prerequisite_module_id') else None,
                passing_score=module['passing_score'],
                is_active=module['is_active'],
                created_at=module['created_at'],
                updated_at=module['updated_at'],
                user_progress=dict(progress) if progress else None,
            )

    return await run_in_threadpool(_get_module)


# ==================== Training Progress ====================

@router.post('/training/progress', response_model=TrainingProgressResponse)
async def update_training_progress(
    progress: TrainingProgressUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> TrainingProgressResponse:
    """
    Update training progress for a module.

    Creates progress record if not exists, updates if exists.
    """
    def _update_progress():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get staff record
            cur.execute(
                "SELECT id FROM retail_staff WHERE user_id = %s LIMIT 1",
                (current_user_id,),
            )
            staff = cur.fetchone()
            if not staff:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is not registered as retail staff",
                )
            staff_id = staff['id']

            # Check module exists
            cur.execute(
                "SELECT id, passing_score FROM staff_training_modules WHERE id = %s",
                (progress.module_id,),
            )
            module = cur.fetchone()
            if not module:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Module not found",
                )

            # Determine status
            new_status = progress.status
            if not new_status:
                if progress.progress_percent == 100:
                    new_status = 'completed'
                elif progress.progress_percent > 0:
                    new_status = 'in_progress'
                else:
                    new_status = 'not_started'

            # Upsert progress
            cur.execute(
                """
                INSERT INTO staff_training_progress (
                    staff_id, module_id, status, progress_percent, started_at
                )
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (staff_id, module_id)
                DO UPDATE SET
                    status = EXCLUDED.status,
                    progress_percent = EXCLUDED.progress_percent,
                    completed_at = CASE
                        WHEN EXCLUDED.status = 'completed' THEN NOW()
                        ELSE staff_training_progress.completed_at
                    END
                RETURNING *
                """,
                (staff_id, progress.module_id, new_status, progress.progress_percent),
            )
            result = cur.fetchone()
            conn.commit()

            return TrainingProgressResponse(**dict(result))

    return await run_in_threadpool(_update_progress)


@router.get('/training/progress', response_model=TrainingProgressListResponse)
async def get_my_training_progress(
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> TrainingProgressListResponse:
    """Get all training progress for current user."""
    def _get_progress():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get staff record
            cur.execute(
                "SELECT id FROM retail_staff WHERE user_id = %s LIMIT 1",
                (current_user_id,),
            )
            staff = cur.fetchone()
            if not staff:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is not registered as retail staff",
                )

            # Get total modules
            cur.execute(
                "SELECT COUNT(*) FROM staff_training_modules WHERE is_active = true"
            )
            total_modules = cur.fetchone()['count']

            # Get user progress
            cur.execute(
                """
                SELECT * FROM staff_training_progress
                WHERE staff_id = %s
                ORDER BY started_at DESC
                """,
                (staff['id'],),
            )
            progress_list = [dict(r) for r in cur.fetchall()]

            completed = sum(1 for p in progress_list if p['status'] == 'completed')
            overall_percent = int((completed / total_modules * 100) if total_modules > 0 else 0)

            return TrainingProgressListResponse(
                progress=progress_list,
                total_modules=total_modules,
                completed_modules=completed,
                overall_progress_percent=overall_percent,
            )

    return await run_in_threadpool(_get_progress)


# ==================== Quiz Submission ====================

@router.post('/training/quiz/submit', response_model=QuizResult)
async def submit_quiz(
    submission: QuizSubmitRequest,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QuizResult:
    """
    Submit quiz answers for a training module.

    Returns score and whether the user passed.
    """
    def _submit_quiz():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get staff record
            cur.execute(
                "SELECT id FROM retail_staff WHERE user_id = %s LIMIT 1",
                (current_user_id,),
            )
            staff = cur.fetchone()
            if not staff:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is not registered as retail staff",
                )
            staff_id = staff['id']

            # Get module and quiz content
            cur.execute(
                """
                SELECT id, passing_score, content_data
                FROM staff_training_modules
                WHERE id = %s AND content_type = 'quiz'
                """,
                (submission.module_id,),
            )
            module = cur.fetchone()
            if not module:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Quiz module not found",
                )

            # Get quiz questions from content_data
            quiz_data = module.get('content_data', {}) or {}
            questions = quiz_data.get('questions', [])

            if not questions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No quiz questions found",
                )

            # Calculate score
            correct = 0
            feedback = []
            question_map = {q['id']: q for q in questions}

            for answer in submission.answers:
                question = question_map.get(answer.question_id)
                if question:
                    is_correct = str(answer.selected_option) == str(question.get('correct_answer'))
                    if is_correct:
                        correct += 1
                    feedback.append({
                        'question_id': answer.question_id,
                        'correct': is_correct,
                        'correct_answer': question.get('correct_answer'),
                    })

            total_questions = len(questions)
            score = int((correct / total_questions * 100) if total_questions > 0 else 0)
            passed = score >= module['passing_score']

            # Update progress
            new_status = 'completed' if passed else 'failed'
            cur.execute(
                """
                INSERT INTO staff_training_progress (
                    staff_id, module_id, status, progress_percent,
                    quiz_attempts, best_score, started_at
                )
                VALUES (%s, %s, %s, 100, 1, %s, NOW())
                ON CONFLICT (staff_id, module_id)
                DO UPDATE SET
                    status = CASE
                        WHEN %s > COALESCE(staff_training_progress.best_score, 0)
                        THEN EXCLUDED.status
                        ELSE staff_training_progress.status
                    END,
                    progress_percent = 100,
                    quiz_attempts = staff_training_progress.quiz_attempts + 1,
                    best_score = GREATEST(COALESCE(staff_training_progress.best_score, 0), %s),
                    completed_at = CASE
                        WHEN EXCLUDED.status = 'completed' THEN NOW()
                        ELSE staff_training_progress.completed_at
                    END
                RETURNING quiz_attempts
                """,
                (staff_id, submission.module_id, new_status, score, score, score),
            )
            result = cur.fetchone()
            conn.commit()

            return QuizResult(
                module_id=submission.module_id,
                score=score,
                passing_score=module['passing_score'],
                passed=passed,
                correct_answers=correct,
                total_questions=total_questions,
                attempt_number=result['quiz_attempts'],
                feedback=feedback if not passed else None,
            )

    return await run_in_threadpool(_submit_quiz)


# ==================== Certification ====================

@router.get('/certification', response_model=CertificationStatus)
async def get_certification_status(
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> CertificationStatus:
    """
    Get current user's certification status.

    Shows whether user is certified and what steps remain.
    """
    def _get_certification():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get staff record
            cur.execute(
                """
                SELECT rs.*, ap.display_name
                FROM retail_staff rs
                JOIN app_profiles ap ON ap.id = rs.user_id
                WHERE rs.user_id = %s
                LIMIT 1
                """,
                (current_user_id,),
            )
            staff = cur.fetchone()
            if not staff:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is not registered as retail staff",
                )

            # Get module completion stats
            cur.execute(
                """
                SELECT
                    COUNT(*) FILTER (WHERE stm.is_active = true) as total,
                    COUNT(*) FILTER (WHERE stp.status = 'completed') as completed
                FROM staff_training_modules stm
                LEFT JOIN staff_training_progress stp
                    ON stp.module_id = stm.id AND stp.staff_id = %s
                WHERE stm.is_active = true
                """,
                (staff['id'],),
            )
            stats = cur.fetchone()

            is_certified = staff['is_certified']
            expires_at = staff.get('certification_expires_at')
            days_until_expiry = None

            if expires_at:
                days_until_expiry = (expires_at - datetime.utcnow()).days

            # Determine next step
            next_step = None
            can_certify = stats['completed'] == stats['total'] and stats['total'] > 0

            if not is_certified:
                if stats['completed'] < stats['total']:
                    next_step = f"Complete {stats['total'] - stats['completed']} more training modules"
                elif can_certify:
                    next_step = "All modules completed! Apply for certification"
            elif days_until_expiry and days_until_expiry < 30:
                next_step = "Certification expiring soon, complete refresher training"

            return CertificationStatus(
                is_certified=is_certified,
                certified_at=staff.get('certified_at'),
                expires_at=expires_at,
                days_until_expiry=days_until_expiry,
                modules_completed=stats['completed'],
                total_modules=stats['total'],
                can_take_certification=can_certify and not is_certified,
                next_step=next_step,
            )

    return await run_in_threadpool(_get_certification)


# ==================== Assisted Scans ====================

@router.post('/assisted-scan', response_model=AssistedScanResponse)
async def log_assisted_scan(
    scan: AssistedScanCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> AssistedScanResponse:
    """
    Log a staff-assisted scan.

    Used when staff helps a customer scan or explains trust badges.
    """
    def _log_scan():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get staff record
            cur.execute(
                "SELECT id FROM retail_staff WHERE user_id = %s LIMIT 1",
                (current_user_id,),
            )
            staff = cur.fetchone()
            if not staff:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is not registered as retail staff",
                )

            # Verify scan event exists
            cur.execute(
                "SELECT id FROM store_scan_events WHERE id = %s",
                (scan.scan_event_id,),
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Scan event not found",
                )

            # Log assisted scan
            cur.execute(
                """
                INSERT INTO staff_assisted_scans (
                    staff_id, scan_event_id, assistance_type
                )
                VALUES (%s, %s, %s)
                RETURNING *
                """,
                (staff['id'], scan.scan_event_id, scan.assistance_type),
            )
            result = cur.fetchone()

            # Update staff counters
            cur.execute(
                """
                UPDATE retail_staff
                SET
                    customer_assists = customer_assists + 1,
                    scans_assisted = CASE
                        WHEN %s = 'helped_scan' THEN scans_assisted + 1
                        ELSE scans_assisted
                    END,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (scan.assistance_type, staff['id']),
            )

            conn.commit()
            return AssistedScanResponse(**dict(result))

    return await run_in_threadpool(_log_scan)


# ==================== Store Staff Management ====================

@store_staff_router.get('/{store_id}/staff', response_model=RetailStaffListResponse)
async def list_store_staff(
    store_id: str,
    is_certified: bool | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> RetailStaffListResponse:
    """List staff members at a specific store."""
    def _list_staff():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            conditions = ["rs.store_id = %s"]
            params = [store_id]

            if is_certified is not None:
                conditions.append("rs.is_certified = %s")
                params.append(is_certified)

            where_clause = " AND ".join(conditions)

            # Count total
            cur.execute(
                f"""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE rs.is_certified = true) as certified
                FROM retail_staff rs
                WHERE {where_clause}
                """,
                params,
            )
            counts = cur.fetchone()

            # Get staff with user info
            cur.execute(
                f"""
                SELECT rs.*, ap.display_name as user_name, ap.email as user_email
                FROM retail_staff rs
                LEFT JOIN app_profiles ap ON ap.id = rs.user_id
                WHERE {where_clause}
                ORDER BY rs.is_certified DESC, rs.scans_assisted DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            staff = [dict(r) for r in cur.fetchall()]

            return RetailStaffListResponse(
                staff=staff,
                total=counts['total'],
                certified_count=counts['certified'],
            )

    return await run_in_threadpool(_list_staff)


@store_staff_router.get('/{store_id}/staff/leaderboard', response_model=StaffLeaderboardResponse)
async def get_staff_leaderboard(
    store_id: str,
    period: str = Query(default="monthly", pattern="^(weekly|monthly|all_time)$"),
    limit: int = Query(default=10, ge=1, le=50),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> StaffLeaderboardResponse:
    """
    Get staff engagement leaderboard for a store.

    Ranks staff by customer assists and scans helped.
    """
    def _get_leaderboard():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get store info
            cur.execute(
                "SELECT id, name FROM retail_stores WHERE id = %s",
                (store_id,),
            )
            store = cur.fetchone()
            if not store:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Store not found",
                )

            # Get staff ranked by engagement
            cur.execute(
                """
                SELECT
                    rs.id as staff_id,
                    ap.display_name as staff_name,
                    rs.department,
                    rs.customer_assists,
                    rs.scans_assisted,
                    rs.is_certified,
                    (rs.customer_assists * 1 + rs.scans_assisted * 2) as score
                FROM retail_staff rs
                LEFT JOIN app_profiles ap ON ap.id = rs.user_id
                WHERE rs.store_id = %s
                ORDER BY score DESC
                LIMIT %s
                """,
                (store_id, limit),
            )

            entries = []
            for idx, r in enumerate(cur.fetchall(), 1):
                entries.append(StaffLeaderboardEntry(
                    rank=idx,
                    staff_id=str(r['staff_id']),
                    staff_name=r['staff_name'] or 'Anonymous',
                    department=r['department'],
                    customer_assists=r['customer_assists'],
                    scans_assisted=r['scans_assisted'],
                    is_certified=r['is_certified'],
                    score=r['score'],
                ))

            return StaffLeaderboardResponse(
                entries=entries,
                period=period,
                store_id=store_id,
                store_name=store['name'],
            )

    return await run_in_threadpool(_get_leaderboard)
