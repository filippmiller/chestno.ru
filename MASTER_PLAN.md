# MASTER IMPLEMENTATION PLAN - Chestno.ru MVP
## Critical Analysis & Orchestration

**Date:** 2026-01-26
**Orchestrator:** Claude Sonnet 4.5
**Total Scope:** 4 feature sets, ~520 hours, 8-12 weeks

---

## 🎯 CRITICAL ANALYSIS

### 1. DEPENDENCY MAP

```
┌─────────────────┐
│  QR Improvements│ (12-14h)
│  [INDEPENDENT]  │ ← Can start immediately
└─────────────────┘

┌─────────────────┐
│ Status Levels   │ (78-106h)
│  [FOUNDATION]   │ ← Required by Payments & Stories
└────────┬────────┘
         │
    ┌────▼─────┐  ┌──────────────┐
    │ Payments │  │   Stories    │
    │ (27h)    │  │   (326h)     │
    └──────────┘  └──────────────┘
```

**Key Dependencies:**
- **Status Levels → Payments**: Payments grant status levels (A/B)
- **Status Levels → Stories**: Story activity affects status degradation
- **Payments → Stories**: Subscription required to publish Stories
- **QR Improvements**: INDEPENDENT - can run in parallel

### 2. RISK ASSESSMENT

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Status Levels delays entire project** | HIGH | Start immediately, dedicate best resources |
| **Stories scope creep (326h!)** | HIGH | Ship MVP (Phase 1) first, defer Telegram bot to v1 |
| **Payments integration complexity** | MEDIUM | Use sandbox mode extensively, thorough testing |
| **Database migration failures** | HIGH | Test locally first, backup before production |
| **Frontend-backend coupling** | MEDIUM | Backend teams finish APIs first, clear contracts |

### 3. OPTIMAL SEQUENCING

**Stage 1 (Week 1-3): Foundation**
- Status Levels (critical path)
- QR Improvements (parallel, quick win)

**Stage 2 (Week 4-5): Monetization**
- Payments integration
- Status Level integration complete

**Stage 3 (Week 6-9): Content**
- Stories MVP (Phase 1)
- Defer Telegram bot to post-MVP

**Stage 4 (Week 10-12): Polish & Launch**
- Integration testing
- Deployment
- Monitoring setup

### 4. SCOPE REDUCTION RECOMMENDATIONS

#### Stories - DEFER TO v1:
- ❌ Telegram Bot (Phase 2) - 75 hours saved
- ❌ Social Links (Phase 3) - 26 hours saved
- ❌ Advanced features (Phase 4) - Save for v2

**MVP Stories = Phase 1 only (205 hours)**

#### Result:
- Original: 520 hours (13 weeks)
- **MVP: 322 hours (8 weeks)**

---

## 🗺️ MASTER PLAN

### STAGE 1: FOUNDATION (Weeks 1-3, ~120h)

**Goal:** Build core status system + quick wins

#### Stream A: Status Levels (78-106h)
**Priority:** CRITICAL
**Team:** 2 Backend + 1 Frontend
**Phases:**
1. Database (8-12h)
2. Backend API (16-20h)
3. Frontend UI (20-24h)
4. Cron Jobs (8-12h)
5. Testing (12-16h)
6. Deployment (4-6h)

#### Stream B: QR Improvements (12-14h) - PARALLEL
**Priority:** HIGH
**Team:** 1 Full-stack
**Phases:**
1. Time-series analytics (3h)
2. QR customization (5h)
3. Batch operations (4h)

**Milestone:** Status Levels deployed, QR improvements live

---

### STAGE 2: MONETIZATION (Weeks 4-5, ~27h)

**Goal:** Enable paid subscriptions

#### Stream A: Payments Integration (27h)
**Priority:** CRITICAL
**Team:** 2 Backend + 1 Frontend
**Dependencies:** Status Levels complete
**Phases:**
1. Database (2h)
2. Backend Services (6h)
3. API Endpoints (4h)
4. Webhook Integration (2h)
5. Testing (8h)
6. Deployment (3h)
7. Monitoring (2h)

**Milestone:** Trial signup works, first payment processes

---

### STAGE 3: CONTENT ENGINE (Weeks 6-9, ~205h)

**Goal:** Stories publishing system (MVP only)

#### Stream A: Stories MVP - Phase 1 (205h)
**Priority:** HIGH
**Team:** 2 Backend + 2 Frontend + 1 QA
**Dependencies:** Payments complete
**Weeks:**
- Week 1: Database + Backend Foundation (60h)
- Week 2: Frontend Components (40h)
- Week 3: Pages & Integration (50h)
- Week 4: Testing & Polish (55h)

**OUT OF SCOPE (defer to v1):**
- ❌ Telegram Bot
- ❌ Social Links
- ❌ AI features

**Milestone:** Producer can create Story, admin can moderate, customer can view

---

### STAGE 4: INTEGRATION & LAUNCH (Weeks 10-12, ~40h)

**Goal:** End-to-end testing, production deployment, monitoring

#### Activities:
1. **Integration Testing (16h)**
   - Status Levels → Payments flow
   - Payments → Stories feature gating
   - Stories → Status degradation
   - QR codes work with all features

2. **Production Deployment (12h)**
   - Database migrations (all 4 systems)
   - Backend deployment (Railway)
   - Frontend deployment (Vercel/hosting)
   - Smoke tests

3. **Monitoring Setup (8h)**
   - Error tracking (Sentry)
   - Metrics dashboards
   - Alert configuration
   - Webhook monitoring

4. **Documentation (4h)**
   - API docs (Swagger)
   - User guides
   - Admin guides
   - Session notes

**Milestone:** MVP LAUNCH READY

---

## 📋 SESSION BREAKDOWN

### SESSION 1: Status Levels - Database & Backend
**Duration:** 2-3 days
**Agent Count:** 2 (Parallel)
**Tasks:** Phase 1-2 from IMPL_Status_Levels_v1.md

### SESSION 2: Status Levels - Frontend & Testing
**Duration:** 2-3 days
**Agent Count:** 2 (Parallel)
**Tasks:** Phase 3-5 from IMPL_Status_Levels_v1.md

### SESSION 3: QR Improvements (Full)
**Duration:** 1 day
**Agent Count:** 1 (Sequential phases)
**Tasks:** All 3 phases from IMPL_QR_Improvements_v1.md

### SESSION 4: Payments - Backend Integration
**Duration:** 2 days
**Agent Count:** 2 (Parallel)
**Tasks:** Phase 1-4 from IMPL_Payments_v1.md

### SESSION 5: Payments - Testing & Deployment
**Duration:** 1-2 days
**Agent Count:** 2 (Parallel)
**Tasks:** Phase 5-7 from IMPL_Payments_v1.md

### SESSION 6: Stories MVP - Week 1
**Duration:** 1 week
**Agent Count:** 3 (Parallel streams)
**Tasks:** Database + Backend from IMPL_Stories_v1.md Phase 1

### SESSION 7: Stories MVP - Week 2
**Duration:** 1 week
**Agent Count:** 2 (Frontend parallel)
**Tasks:** Frontend Components from IMPL_Stories_v1.md Phase 1

### SESSION 8: Stories MVP - Week 3-4
**Duration:** 2 weeks
**Agent Count:** 3 (Integration + Testing)
**Tasks:** Pages, Integration, Testing from IMPL_Stories_v1.md Phase 1

### SESSION 9: Final Integration & Launch
**Duration:** 3-5 days
**Agent Count:** 4 (Parallel testing streams)
**Tasks:** Cross-feature testing, deployment, monitoring

---

## 🎯 SESSION PROMPTS FOR POWERSHELL

### SESSION 1 PROMPT:
```
Implement Status Levels database and backend API (Phase 1-2).

Read: C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Status_Levels_v1.md

Focus:
- Database migrations (0027, 0028, 0029)
- StatusLevelService implementation
- API routes for /organizations/:id/status
- RLS policies
- Helper functions

Team: 2 agents (1 DB migrations, 1 API service)
Duration: 2-3 days
Critical: This blocks Payments and Stories
```

### SESSION 2 PROMPT:
```
Implement Status Levels frontend UI and testing (Phase 3-5).

Read: C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Status_Levels_v1.md

Focus:
- StatusBadge component
- Organization status dashboard
- Public levels info page
- Upgrade request form
- Unit + integration tests

Team: 2 agents (1 Frontend, 1 Testing)
Duration: 2-3 days
Depends on: Session 1 complete
```

### SESSION 3 PROMPT:
```
Implement QR code improvements (all 3 phases).

Read: C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_QR_Improvements_v1.md

Focus:
- Time-series analytics (timeline charts)
- QR customization (colors, logos, contrast validation)
- Batch operations (bulk create, export ZIP)

Team: 1 full-stack agent
Duration: 1 day
Independent: Can run in parallel with Session 1-2
```

### SESSION 4 PROMPT:
```
Implement Payments backend integration (Phase 1-4).

Read: C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Payments_v1.md

Focus:
- Database migration (payment_transactions, webhooks_log)
- YukassaProvider service
- PaymentService (trial, charge, webhook handling)
- API endpoints (/checkout/trial, /webhooks/yukassa)

Team: 2 agents (1 Services, 1 Webhooks)
Duration: 2 days
Depends on: Session 1 complete (needs status levels integration)
```

### SESSION 5 PROMPT:
```
Implement Payments testing and deployment (Phase 5-7).

Read: C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Payments_v1.md

Focus:
- Unit tests (PaymentService, WebhookService)
- Integration tests (sandbox mode, trial flow)
- Webhook idempotency testing
- Production deployment (Railway, Supabase)
- Monitoring setup

Team: 2 agents (1 Testing, 1 Deployment)
Duration: 1-2 days
Depends on: Session 4 complete
```

### SESSION 6 PROMPT:
```
Implement Stories MVP - Database and Backend (Week 1).

Read: C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Stories_v1.md

Focus: PHASE 1 ONLY (Week 1-2)
- Database migrations (stories, story_views, story_activity_log)
- Pydantic schemas (StoryCreate, StoryUpdate, StoryResponse)
- StoriesService, ModerationService, VideoService
- API routes (/stories, /stories/:id, /admin/moderation)

Team: 3 agents (1 DB, 1 Services, 1 API)
Duration: 1 week
Depends on: Session 5 complete (needs payments integration)
```

### SESSION 7 PROMPT:
```
Implement Stories MVP - Frontend Components (Week 2).

Read: C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Stories_v1.md

Focus: PHASE 1 ONLY (Week 2)
- StoryTypeIcon, ContentOriginBadge components
- StoryCard, StoryPlayer components
- StoryCreationWizard component
- React Query hooks (useStories, useCreateStory)
- API client (storiesApi)

Team: 2 agents (parallel component development)
Duration: 1 week
Depends on: Session 6 complete (API ready)
```

### SESSION 8 PROMPT:
```
Implement Stories MVP - Pages and Testing (Week 3-4).

Read: C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Stories_v1.md

Focus: PHASE 1 ONLY (Week 3-4)
- Organization Stories tab, Story detail page
- Producer dashboard (create, edit, list)
- Admin moderation dashboard
- Integration tests (producer creates, admin moderates, customer views)
- E2E tests (Playwright)

Team: 3 agents (1 Pages, 1 Admin, 1 Testing)
Duration: 2 weeks
Depends on: Session 7 complete
```

### SESSION 9 PROMPT:
```
Final integration testing and production deployment.

Read: All 4 implementation checklists

Focus:
- End-to-end integration testing (Status Levels → Payments → Stories)
- Database migrations (production)
- Backend deployment (Railway)
- Frontend deployment
- Smoke tests (trial signup, story creation, QR generation)
- Monitoring dashboards
- Session notes and documentation

Team: 4 agents (1 Integration, 1 Deploy, 1 Testing, 1 Docs)
Duration: 3-5 days
Depends on: All previous sessions complete
```

---

## ⚡ QUICK START COMMAND

To begin Session 1 immediately:

```powershell
# Copy this into your PowerShell session:
Implement Status Levels database and backend API (Phase 1-2). Read: C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Status_Levels_v1.md. Focus: Database migrations, StatusLevelService, API routes, RLS policies. Team: 2 agents. Duration: 2-3 days. CRITICAL PATH.
```

---

## 📊 MASTER TIMELINE

```
Week 1-3:  [██████████] Status Levels + QR (parallel)
Week 4-5:  [█████─────] Payments
Week 6-7:  [██████████] Stories MVP - Backend + Components
Week 8-9:  [██████████] Stories MVP - Pages + Testing
Week 10-12:[█████─────] Integration + Launch

═══════════════════════════════════════════════════
          LAUNCH MVP (12 weeks from start)
```

---

## 🎓 SUCCESS CRITERIA

**MVP Launch Ready when:**

✅ User can sign up with trial (1₽ pre-auth)
✅ Trial converts to paid subscription (Level A or B)
✅ Organization receives status badge on profile
✅ Producer can create and publish Story
✅ Admin can moderate Stories
✅ Customer can view Stories on org page
✅ QR codes work with analytics and customization
✅ All webhooks processing correctly
✅ Zero critical bugs
✅ Monitoring dashboards live

---

## 📝 DEFERRED TO v1 (Post-MVP)

- Stories Telegram Bot (Phase 2, 75h)
- Stories Social Links (Phase 3, 26h)
- Status Levels auto-grant for Level C
- Payments add-ons system
- Advanced analytics

---

**Master Plan Status:** ✅ READY FOR EXECUTION
**Next Action:** Launch SESSION 1 (Status Levels Database & Backend)
**Orchestrator:** Claude Sonnet 4.5
**Date:** 2026-01-26
