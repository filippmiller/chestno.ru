# Session 19: Content Moderation & Quality Control

**Date:** 2026-02-01  
**Focus:** Comprehensive content moderation system for chestno.ru

---

## Summary

Designed and implemented a full-featured content moderation system to maintain platform integrity and protect against fake businesses, misleading claims, and abuse.

---

## 5 Concrete Moderation Features Implemented

### 1. Prioritized Moderation Queue

**Location:** `supabase/migrations/0035_content_moderation.sql` (moderation_queue table)

**Key Features:**
- Unified queue for all content types (organizations, products, reviews, posts, media, documents, certifications)
- Dynamic priority scoring (0-100) based on:
  - Content type weight (certifications highest)
  - Source of flag (user reports weighted higher)
  - Number of community reports
  - AI confidence scores
  - Violator's past history
- Assignment workflow (pending -> in_review -> resolved)
- Escalation levels (0-3) for complex cases
- Content snapshots for audit purposes

**Database Function:**
```sql
calculate_moderation_priority(
  p_content_type text,
  p_source text,
  p_report_count integer,
  p_ai_confidence numeric,
  p_violator_history integer
) RETURNS integer
```

---

### 2. AI Auto-Moderation System

**Location:** `backend/app/services/content_moderation.py` (AIContentModerator class)

**Key Features:**
- Pattern-based detection system
- Configurable patterns stored in database (`ai_moderation_patterns` table)
- Pattern types:
  - `text_keywords` - Keyword matching with fuzzy support
  - `text_regex` - Regular expression patterns
  - `behavioral` - Behavioral rules (e.g., review burst detection)
  - `image_hash` - Perceptual hashing for duplicate images
  - `document_fingerprint` - Document authenticity verification

**Pre-configured Patterns:**
| Pattern | Detects | Action |
|---------|---------|--------|
| Health Claims Keywords | Misleading health claims | Flag for review |
| Spam Patterns | Promotional spam | Flag for review |
| Suspicious Review Burst | Competitor sabotage | Flag for review |
| Offensive Language | Offensive content | Flag for review |

**Auto-Flag Flow:**
1. New content submitted
2. AI analyzes text/images
3. Matches against active patterns
4. If match found: adds to queue with priority boost
5. Moderator reviews with AI context

---

### 3. Community Reporting System

**Location:** `backend/app/api/routes/content_moderation.py` (POST /reports)

**Key Features:**
- Any authenticated user can report content
- Report reasons:
  - `fake_business` - Profile claiming non-existent business
  - `misleading_claims` - False health or quality claims
  - `counterfeit_cert` - Fake certification documents
  - `offensive_content` - Inappropriate material
  - `spam` - Unwanted promotional content
  - `competitor_sabotage` - Fake negative reviews
  - `copyright` - Unauthorized use of materials
  - `privacy_violation` - Personal data exposure
- Evidence attachment support
- Duplicate detection (24-hour cooldown per user/content)
- Reports automatically create or update queue items

**Frontend Component:** `frontend/src/components/moderation/ReportContentModal.tsx`
- User-friendly reporting form
- Reason selection with descriptions
- Evidence URL attachment
- Submission confirmation

---

### 4. Appeal Process for Producers

**Location:** `backend/app/services/content_moderation.py` (create_appeal, decide_appeal)

**Key Features:**
- Producers can contest moderation decisions
- Appeal includes:
  - Original rejection reference
  - Appeal reason (text)
  - Supporting evidence URLs
  - Additional context
- Appeal statuses: pending -> under_review -> upheld/overturned/partially_overturned
- Senior moderator review required
- Automatic content restoration if overturned
- 24-hour duplicate appeal prevention

**Database Table:** `moderation_appeals`
```sql
CREATE TABLE moderation_appeals (
    id uuid PRIMARY KEY,
    original_queue_item_id uuid,
    appellant_user_id uuid,
    appeal_reason text,
    supporting_evidence text[],
    status text, -- pending, under_review, upheld, overturned
    reviewed_by uuid,
    review_decision text,
    ...
);
```

---

### 5. Moderator Tools & Dashboard

**Location:** `frontend/src/components/moderation/ModerationDashboard.tsx`

**Dashboard Features:**
- Real-time statistics:
  - Pending items count
  - In-review count
  - Escalated count
  - Appeals count
  - Resolved today
  - Average resolution time
- Filterable queue view:
  - By status
  - By content type
  - By source
  - By priority
- Pagination and sorting

**Item Detail View:** `ModerationItemDetail.tsx`
- Full content snapshot display
- AI flags with confidence scores
- Priority reasons breakdown
- Quick action buttons (Approve, Reject, Escalate)
- Violation type and guideline selection
- Notes and history tabs

**Additional Tools:**
| Tool | Purpose |
|------|---------|
| Moderator Notes | Internal annotations on content/users |
| Violation History | Track repeat offenders |
| Batch Actions | Approve/reject multiple items |
| Escalation Path | Send to senior moderators |

---

## Quality Guidelines System

**Location:** `moderation_guidelines` table

**Pre-configured Guidelines:**
| Code | Category | Severity | Auto-Flag |
|------|----------|----------|-----------|
| AUTH_FAKE_BUSINESS | Authenticity | Critical | Yes |
| AUTH_COUNTERFEIT_CERT | Authenticity | Critical | Yes |
| ACC_MISLEADING_HEALTH | Accuracy | High | Yes |
| ACC_FALSE_ORIGIN | Accuracy | High | Yes |
| QUAL_LOW_PHOTO | Quality | Low | No |
| SAFE_OFFENSIVE | Safety | High | Yes |
| COMM_COMPETITOR_ATTACK | Community | Medium | Yes |
| COMM_SPAM | Community | Medium | Yes |
| LEGAL_COPYRIGHT | Legal | High | No |

---

## API Endpoints

### Queue Management
- `GET /api/moderation/v2/queue/stats` - Queue statistics
- `GET /api/moderation/v2/queue` - List queue items (with filters)
- `GET /api/moderation/v2/queue/{id}` - Get item details
- `POST /api/moderation/v2/queue/{id}/assign` - Assign to moderator
- `POST /api/moderation/v2/queue/{id}/decide` - Make decision

### Batch Operations
- `POST /api/moderation/v2/queue/batch/approve` - Batch approve
- `POST /api/moderation/v2/queue/batch/reject` - Batch reject

### Community Reports
- `POST /api/moderation/v2/reports` - Create report
- `GET /api/moderation/v2/reports` - List reports (moderator)

### Appeals
- `POST /api/moderation/v2/appeals` - Create appeal
- `GET /api/moderation/v2/appeals` - List appeals (moderator)
- `POST /api/moderation/v2/appeals/{id}/decide` - Decide appeal

### Notes & History
- `POST /api/moderation/v2/notes` - Add moderator note
- `GET /api/moderation/v2/notes/{type}/{id}` - Get notes
- `GET /api/moderation/v2/violations/{type}/{id}` - Violation history

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/0035_content_moderation.sql` | Database schema |
| `backend/app/services/content_moderation.py` | Core moderation service |
| `backend/app/schemas/content_moderation.py` | Pydantic schemas |
| `backend/app/api/routes/content_moderation.py` | API routes |
| `frontend/src/types/moderation.ts` | TypeScript types |
| `frontend/src/components/moderation/ModerationDashboard.tsx` | Main dashboard |
| `frontend/src/components/moderation/ModerationQueueTable.tsx` | Queue table |
| `frontend/src/components/moderation/ModerationItemDetail.tsx` | Item detail modal |
| `frontend/src/components/moderation/ReportContentModal.tsx` | User report form |
| `frontend/src/components/moderation/index.ts` | Component exports |

### Modified Files
| File | Change |
|------|--------|
| `backend/app/services/admin_guard.py` | Added `assert_moderator()` function |

---

## Security & Access Control

### Row Level Security Policies
- Moderators can access full queue
- Users can only create reports
- Users can view their own reports
- Users can create appeals for their content
- Violation history internal only
- Notes internal only

### Role Checks
- `assert_moderator()` - Admin or moderator role required
- `assert_platform_admin()` - Admin role only (for escalations)

---

## Next Steps

1. **Register API Router** - Add content_moderation router to main app
2. **Add Moderation Page Route** - Create admin/moderation page in frontend
3. **Integrate Report Button** - Add to review, post, and organization components
4. **Email Notifications** - Notify users of moderation decisions
5. **Metrics Dashboard** - Track moderator performance and queue health
6. **Image Moderation** - Integrate image analysis API for offensive content
7. **Document Verification** - Add certificate authenticity checking

---

## Knowledge Captured

- Moderation systems need multiple input sources (AI, users, new content)
- Priority scoring should be dynamic and context-aware
- Appeal process builds producer trust
- Moderator tools must provide context (history, notes)
- Batch operations essential for high-volume queues
- Guidelines should be versioned and auditable
