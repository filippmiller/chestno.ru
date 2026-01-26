# SESSION PROMPTS - Copy & Paste for PowerShell

## How to Use

1. Copy the prompt for the session you want to start
2. Paste directly into Claude Code PowerShell session
3. Agent will read the implementation checklist and begin work
4. Multiple agents can run in parallel (see "Parallel Sessions" section)

---

## 🚀 SESSION 1: Status Levels - Database & Backend

**Copy this:**

```
Implement Status Levels database and backend API (Phase 1-2). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Status_Levels_v1.md. Tasks: Database migrations (tables: organization_status_levels, organization_status_history, status_upgrade_requests), RLS policies, SQL functions (get_current_status_level, check_level_c_criteria, grant_status_level), StatusLevelService implementation, API routes (/organizations/:id/status, /admin/organizations/:id/status-levels), notification service. Team: 2 parallel agents (1 DB, 1 API). Duration: 2-3 days. CRITICAL PATH - blocks Payments and Stories.
```

---

## 🎨 SESSION 2: Status Levels - Frontend & Testing

**Copy this:**

```
Implement Status Levels frontend UI and testing (Phase 3-5). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Status_Levels_v1.md. Tasks: Components (StatusBadge, StatusCard, LevelCProgress, UpgradeRequestForm), Pages (OrganizationStatus dashboard, public Levels info page), integrate badge on org profile, notification components, unit tests (>85% coverage), integration tests, E2E tests (Playwright). Team: 2 parallel agents (1 Frontend, 1 Testing). Duration: 2-3 days. Depends on: Session 1 complete.
```

---

## ⚡ SESSION 3: QR Improvements (All Phases)

**Copy this:**

```
Implement QR code improvements (all 3 phases). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_QR_Improvements_v1.md. Tasks: Phase 1 (time-series analytics: timeline endpoint, QRTimelineChart component, period selector), Phase 2 (QR customization: color picker, logo upload, contrast validation, QRCustomizer component), Phase 3 (batch operations: bulk create endpoint, export ZIP, selection mode UI, CSV upload). Team: 1 full-stack agent (sequential phases). Duration: 1 day (12-14 hours). INDEPENDENT - can run parallel with Sessions 1-2.
```

---

## 💳 SESSION 4: Payments - Backend Integration

**Copy this:**

```
Implement Payments backend integration (Phase 1-4). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Payments_v1.md. Tasks: Database migration (payment_transactions, payment_webhooks_log, subscription_retry_attempts), YukassaProvider service (create_payment, get_payment_status, refund_payment, create_preauth), PaymentService (initiate_trial_with_preauth, charge_subscription, process_payment_success, process_payment_failure), WebhookService (process_webhook with idempotency), API endpoints (/payments/checkout/trial, /payments/checkout/subscription, /webhooks/yukassa with signature verification). Team: 2 parallel agents (1 Services, 1 Webhooks). Duration: 2 days. Depends on: Session 1 (needs status levels integration).
```

---

## 🧪 SESSION 5: Payments - Testing & Deployment

**Copy this:**

```
Implement Payments testing and deployment (Phase 5-7). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Payments_v1.md. Tasks: Unit tests (PaymentService, WebhookService, test_initiate_trial, test_payment_success, test_payment_failure_triggers_grace_period), Integration tests (sandbox mode: Trial→Paid success, Failed payment→Grace period→Recovery, Upgrade A→B, Webhook idempotency), Load testing (10 req/s webhooks), Security testing (invalid signature, SQL injection, rate limiting), Production deployment (Railway secrets, Supabase migration, webhook registration with ЮKassa), Monitoring setup (failed webhooks alerts, grace period tracking, revenue metrics). Team: 2 parallel agents (1 Testing, 1 Deployment). Duration: 1-2 days. Depends on: Session 4.
```

---

## 📖 SESSION 6: Stories MVP - Database & Backend (Week 1)

**Copy this:**

```
Implement Stories MVP database and backend (Phase 1 Week 1-2). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Stories_v1.md. Tasks: Database migrations (stories table with story_type/content_origin/status enums, story_views, story_activity_log, RLS policies), Pydantic schemas (StoryType enum, ContentOrigin enum, StoryStatus enum, StoryBase, StoryCreate, StoryUpdate, StoryResponse), Services (StoriesService: create_story/get_story/get_stories/update_story/delete_story/submit_for_moderation, ModerationService: get_pending_stories/approve_story/reject_story, VideoService: upload_video/extract_metadata/generate_thumbnail/validate_video, StoryPermissions), API routes (/stories GET/POST, /stories/:id GET/PATCH/DELETE, /stories/:id/submit POST, /stories/:id/view POST, /admin/stories/pending, /admin/stories/:id/approve, /admin/stories/:id/reject), upload endpoints (upload-video, upload-image). PHASE 1 ONLY, skip Telegram bot. Team: 3 parallel agents (1 DB, 1 Services, 1 API). Duration: 1 week. Depends on: Session 5 (needs payments integration).
```

---

## 🎨 SESSION 7: Stories MVP - Frontend Components (Week 2)

**Copy this:**

```
Implement Stories MVP frontend components (Phase 1 Week 2). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Stories_v1.md. Tasks: Core components (StoryTypeIcon with emoji icons, ContentOriginBadge with tooltips, StoryCard with onClick handler, StoryPlayer with ReactPlayer and analytics tracking, StoryCreationWizard multi-step form with type selection/content input/preview), API client (storiesApi.getStories/getStory/createStory/updateStory/deleteStory/submitForModeration/uploadVideo/uploadImage), State management (React Query hooks: useStories, useStory, useCreateStory, useUpdateStory, useDeleteStory). PHASE 1 ONLY. Team: 2 parallel agents (component development). Duration: 1 week. Depends on: Session 6 (API ready).
```

---

## 📄 SESSION 8: Stories MVP - Pages & Testing (Week 3-4)

**Copy this:**

```
Implement Stories MVP pages and testing (Phase 1 Week 3-4). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Stories_v1.md. Tasks: Public pages (Organization Stories tab with StoriesGrid and FeaturedStoryCard, Story detail page with StoryPlayer and view tracking), Producer dashboard (ProducerStoriesDashboard with stories list and filters, CreateStoryPage with StoryCreationWizard, EditStoryPage for draft/rejected stories), Admin pages (AdminStoriesModerationPage with ModerationQueue, StoryReviewModal with approve/reject), Mobile responsive (adapt StoryCard/StoryPlayer/CreationForm for mobile, touch gestures), Integration (notifications service, status levels integration, subscriptions feature gates, QR landing page stories section), E2E tests (producer creates story, admin moderates, customer views, Playwright), Performance tests (GET /stories 50 RPS, POST /stories 10 RPS, video upload 10 concurrent). PHASE 1 ONLY. Team: 3 parallel agents (1 Pages, 1 Admin, 1 Testing). Duration: 2 weeks. Depends on: Session 7.
```

---

## 🚀 SESSION 9: Final Integration & Launch

**Copy this:**

```
Final integration testing and production deployment. Read all 4 checklists: IMPL_Status_Levels_v1.md, IMPL_Stories_v1.md, IMPL_QR_Improvements_v1.md, IMPL_Payments_v1.md. Tasks: Integration testing (Status Levels→Payments flow, Payments→Stories feature gating, Stories→Status degradation, QR codes with all features), E2E user journeys (new org→trial→level A, level A→production→level B, level B→meet criteria→level C, status expires→degradation, admin revokes status, producer creates story→admin moderates→customer views, QR generation→analytics→customization), Production deployment (Database migrations all 4 systems, Backend deployment Railway, Frontend deployment, ЮKassa webhook production registration, Supabase Storage buckets verification), Smoke tests (trial signup works, first payment processes, story creation works, QR generation works, all webhooks processing), Monitoring setup (error tracking Sentry, metrics dashboards, webhook monitoring, failed payments alerts, grace period tracking, revenue metrics), Documentation (API docs Swagger, user guides, admin guides, session notes). Team: 4 parallel agents (1 Integration, 1 Deploy, 1 Testing, 1 Docs). Duration: 3-5 days. Depends on: All sessions 1-8 complete. LAUNCH READY.
```

---

## 🔄 PARALLEL SESSIONS (Optional)

You can run multiple sessions in parallel if you have separate PowerShell instances:

### Option A: Fast Track (Weeks 1-3)
```powershell
# Terminal 1 (CRITICAL PATH)
# Session 1: Status Levels DB + Backend

# Terminal 2 (PARALLEL - Independent)
# Session 3: QR Improvements
```

### Option B: Week 4-5 Parallel
```powershell
# Terminal 1
# Session 4: Payments Backend

# Terminal 2
# Session 2 (if not done): Status Levels Frontend
```

---

## 📋 SESSION CHECKLIST

Track your progress:

- [ ] **SESSION 1** - Status Levels DB + Backend (2-3 days)
- [ ] **SESSION 2** - Status Levels Frontend + Testing (2-3 days)
- [ ] **SESSION 3** - QR Improvements (1 day) ← Can run parallel with Session 1-2
- [ ] **SESSION 4** - Payments Backend (2 days)
- [ ] **SESSION 5** - Payments Testing + Deploy (1-2 days)
- [ ] **SESSION 6** - Stories DB + Backend (1 week)
- [ ] **SESSION 7** - Stories Frontend Components (1 week)
- [ ] **SESSION 8** - Stories Pages + Testing (2 weeks)
- [ ] **SESSION 9** - Final Integration + Launch (3-5 days)

---

## 🎯 RECOMMENDED START

**Day 1 - RIGHT NOW:**

Open 2 PowerShell terminals:

**Terminal 1 (Critical Path):**
```
Implement Status Levels database and backend API (Phase 1-2). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Status_Levels_v1.md. Tasks: Database migrations, StatusLevelService, API routes, RLS policies. Team: 2 agents. CRITICAL PATH.
```

**Terminal 2 (Quick Win):**
```
Implement QR code improvements (all 3 phases). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_QR_Improvements_v1.md. Tasks: time-series analytics, QR customization, batch operations. Team: 1 agent. INDEPENDENT.
```

This gives you:
- Parallel work (no blocking)
- Quick win with QR (1 day completion)
- Foundation for Payments (Status Levels)

---

**Created:** 2026-01-26
**Status:** Ready for execution
**Orchestrator:** Claude Sonnet 4.5
