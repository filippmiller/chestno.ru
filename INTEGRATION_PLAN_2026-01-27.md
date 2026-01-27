# Integration & Deployment Plan
**Date:** 2026-01-27
**Status:** Ready for Integration Testing

---

## Executive Summary

Two parallel agent implementations completed successfully:
- **Agent 1:** Payments Integration (YooKassa) - Backend MVP Complete
- **Agent 2:** QR Code Improvements (Timeline, Customization, Batch Ops) - Full-Stack Complete

**Critical Issues Found:**
1. ❌ Migration number conflict: Duplicate `0031` migrations
2. ❌ Duplicate timeline index migration (0030 and 0031 have same content)
3. ⚠️ Large number of deleted files in git status
4. ⚠️ Both features need integration testing together

---

## Critical: Migration Conflict Resolution

### Problem
```
✅ 0030_qr_timeline_index.sql       (QR timeline index)
❌ 0031_qr_timeline_index.sql       (DUPLICATE - same as 0030)
⚠️  0031_payments_integration.sql   (Payments - conflicts with above)
✅ 0032_qr_customization.sql        (QR customization)
```

### Solution
**Step 1:** Delete duplicate migration
```bash
rm supabase/migrations/0031_qr_timeline_index.sql
```

**Step 2:** Renumber payments migration (if needed)
- Option A: Keep as 0031 (since duplicate will be deleted)
- Option B: Renumber to 0033 (safer, avoids confusion)

**Recommended:** Keep 0031_payments_integration.sql as is after deleting duplicate.

**Final migration sequence:**
- 0030_qr_timeline_index.sql ✅
- 0031_payments_integration.sql ✅
- 0032_qr_customization.sql ✅

---

## Implementation Status

### Agent 1: Payments Integration ✅

**Completed:**
- ✅ Database schema (3 tables, 2 extended tables, DB functions)
- ✅ YukassaProvider service (SDK wrapper)
- ✅ PaymentService (business logic + status_levels integration)
- ✅ WebhookService (signature verification, idempotency)
- ✅ API endpoints (checkout, transactions, webhook)
- ✅ Pydantic schemas
- ✅ Unit tests (test_payment_service.py, test_webhook_service.py)
- ✅ Documentation (PAYMENTS_IMPLEMENTATION_COMPLETE.md)
- ✅ requirements.txt updated

**Integration Points:**
- ✅ status_levels.ensure_level_a() on trial start
- ✅ status_levels.ensure_level_a() on payment success
- ✅ status_levels.start_grace_period() on payment failure
- ⏳ Cron job for grace period expiry (Phase 2 - future)

**Next Steps:**
- Install dependencies: `pip install yookassa`
- Set YooKassa credentials in .env
- Apply migration: 0031_payments_integration.sql
- Test trial flow in sandbox
- Run unit tests

### Agent 2: QR Improvements ✅

**Completed:**
- ✅ Phase 1: Timeline frontend (backend pre-existed)
- ✅ Phase 2: QR customization (full-stack)
- ✅ Phase 3: Batch operations (full-stack)
- ✅ Database migrations (0030, 0032)
- ✅ Backend services (contrast calculation, CRUD, bulk ops)
- ✅ Frontend components (QRTimelineChart, QRCustomizer, BulkCreateModal)
- ✅ Unit tests (test_qr_contrast.py)
- ✅ Documentation (SESSION_NOTES_QR_IMPROVEMENTS_2026-01-27.md)
- ✅ Dependencies added (recharts, react-colorful)

**Integration Points:**
- ✅ Integrates with existing QR service
- ✅ Uses Supabase Storage for logos (qr-logos bucket)
- ⏳ No direct payment integration needed

**Next Steps:**
- Create Supabase Storage bucket: `qr-logos`
- Apply migrations: 0030, 0032
- Install frontend dependencies: `npm install recharts react-colorful`
- Test all 3 phases manually
- Run unit tests

---

## Integration Testing Plan

### 1. Database Migrations

**Order of execution:**
```bash
# 1. Check current migration status
npx supabase db diff

# 2. Apply migrations in sequence
npx supabase db push

# 3. Verify migrations applied
# Check tables exist:
# - payment_transactions
# - payment_webhooks_log
# - subscription_retry_attempts
# - qr_customization_settings
# - idx_qr_events_timeline (index)
```

### 2. Dependencies Installation

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# Key new dependency: yookassa
```

**Frontend:**
```bash
cd frontend
npm install
# Key new dependencies: recharts, react-colorful
```

### 3. Environment Variables

**Required for Payments:**
```bash
# .env additions
YUKASSA_SHOP_ID=your_shop_id
YUKASSA_SECRET_KEY=your_secret_key
YUKASSA_WEBHOOK_SECRET=your_webhook_secret
YUKASSA_SANDBOX_MODE=True
PAYMENT_CURRENCY=RUB
PAYMENT_RETURN_URL=http://localhost:5173/subscription/success
PAYMENT_CANCEL_URL=http://localhost:5173/subscription/canceled
```

**Required for QR:**
```bash
# No new env vars needed
# Supabase Storage bucket: qr-logos (manual creation in dashboard)
```

### 4. Manual Testing Checklist

#### Payments Testing (Sandbox)
- [ ] Trial initiation with 1₽ pre-auth
- [ ] Webhook: payment.succeeded received
- [ ] 1₽ refunded automatically
- [ ] Level A granted via status_levels
- [ ] First payment after trial
- [ ] Failed payment triggers grace period
- [ ] Grace period retains Level A
- [ ] Webhook idempotency (duplicate handling)
- [ ] Signature verification (invalid signature rejected)

#### QR Testing
- [ ] Timeline chart renders (7d, 30d, 90d, 1y)
- [ ] Color picker updates preview
- [ ] Contrast warning appears (ratio < 3.0)
- [ ] Save disabled for invalid contrast
- [ ] Custom QR codes scan successfully
- [ ] Bulk create via CSV
- [ ] Quota enforcement on bulk create
- [ ] Export ZIP downloads correctly
- [ ] Selection mode works

#### Integration Testing (Both Features)
- [ ] Organization with Level A can create custom QR codes
- [ ] Organization in trial can use QR features
- [ ] Failed payment (grace period) retains QR access
- [ ] Expired grace period revokes QR access
- [ ] Admin dashboard shows payment transactions
- [ ] Admin dashboard shows QR analytics

### 5. Unit Tests

**Run all tests:**
```bash
cd backend

# Payments tests
pytest tests/test_payment_service.py -v
pytest tests/test_webhook_service.py -v

# QR tests
pytest tests/test_qr_contrast.py -v
pytest tests/test_qr_service.py -v
pytest tests/test_qr_api.py -v

# All tests
pytest tests/ -v
```

---

## Deployment Checklist

### Pre-Deployment

1. **Git Cleanup:**
   - [ ] Remove duplicate migration: `rm supabase/migrations/0031_qr_timeline_index.sql`
   - [ ] Stage new files: `git add .`
   - [ ] Review deleted files (many docs in git status)
   - [ ] Commit: `git commit -m "feat: payments integration + QR improvements"`

2. **Database Backup:**
   - [ ] Backup production database before migration
   - [ ] Document rollback procedure

3. **Dependencies Verification:**
   - [ ] Backend: `pip freeze > backend/requirements_frozen.txt`
   - [ ] Frontend: `npm list > frontend/package-list.txt`

4. **Testing:**
   - [ ] All unit tests pass
   - [ ] Manual testing checklist complete
   - [ ] Integration tests pass

### Deployment Steps

**1. Database Migration (Production):**
```bash
# Link to production project
npx supabase link --project-ref <prod_project_ref>

# Push migrations
npx supabase db push

# Verify tables created
npx supabase db diff
```

**2. Create Supabase Storage Bucket:**
- Login to Supabase dashboard (production)
- Storage → New Bucket → Name: `qr-logos`
- Set public/private as per RLS policies
- Configure CORS if needed

**3. Backend Deployment (Railway):**
```bash
# Set environment variables
railway variables set YUKASSA_SHOP_ID=<prod_shop_id>
railway variables set YUKASSA_SECRET_KEY=<prod_secret_key>
railway variables set YUKASSA_WEBHOOK_SECRET=<prod_webhook_secret>
railway variables set YUKASSA_SANDBOX_MODE=false

# Deploy
git push origin main
# Railway auto-deploys
```

**4. Frontend Deployment:**
```bash
# Build
cd frontend
npm run build

# Deploy (depends on hosting - Vercel/Netlify/Railway)
# Railway example:
cd ..
git push origin main
```

**5. YooKassa Webhook Registration:**
- Login to YooKassa dashboard (production)
- Settings → Webhooks
- Add: `https://api.chestno.ru/api/webhooks/yukassa`
- Events: payment.succeeded, payment.failed, payment.canceled
- Test webhook delivery

### Post-Deployment

**Smoke Tests:**
1. **Payments:**
   - [ ] Create trial subscription (use real card, 1₽)
   - [ ] Verify webhook received (check logs)
   - [ ] Verify Level A granted (check database)
   - [ ] Verify 1₽ refunded (check YooKassa)

2. **QR Codes:**
   - [ ] View QR timeline chart
   - [ ] Customize QR colors
   - [ ] Create bulk QR codes
   - [ ] Export QR codes as ZIP

3. **Integration:**
   - [ ] Organization flow: Signup → Trial → QR creation → Timeline
   - [ ] Payment flow: Trial end → First payment → Level A retained

**Monitoring:**
- [ ] Set up Sentry alerts for payment errors
- [ ] Monitor webhook logs for failures
- [ ] Track trial → paid conversion rate
- [ ] Monitor QR scan events

---

## Known Issues & Risks

### Issues
1. ❌ **Duplicate migration (0031)** - Must delete before deployment
2. ⚠️ **Many deleted doc files** - May indicate cleanup needed
3. ⚠️ **QR style rendering** - Style field stored but not applied to generated images (future)
4. ⚠️ **Grace period expiry** - No cron job yet (Phase 2)

### Risks
1. **Migration conflict** - Could cause deployment failure if not fixed
2. **Webhook signature** - Must verify YooKassa webhook secret is correct
3. **Storage bucket** - Manual creation required, can't be automated via migration
4. **Rate limiting** - Webhook endpoint not rate-limited yet (future)

### Mitigations
1. **Pre-deployment testing** - Complete all manual tests in sandbox
2. **Database backup** - Backup before migration
3. **Rollback plan** - Document rollback procedure for each migration
4. **Monitoring** - Set up alerts for payment errors

---

## Future Work

### Phase 2 (Next Sprint)

**Payments:**
- [ ] Cron job for grace period expiry
- [ ] Automatic payment retry logic (day 3, 7, 14)
- [ ] Email notifications (trial start, payment success/failure, grace ending)
- [ ] Level B support (one-time + subscription)
- [ ] Upgrade flow (A → B with proration)
- [ ] Admin dashboard (subscriptions, grace periods, revenue metrics)

**QR Codes:**
- [ ] QR style rendering (dots, rounded)
- [ ] Logo validation (dimensions, file size)
- [ ] Background export for large batches
- [ ] Bulk edit customization
- [ ] Print templates (PDF generation)
- [ ] A/B testing for QR codes

**Integration:**
- [ ] Payment history in QR management page
- [ ] QR usage stats in subscription page
- [ ] Combined analytics dashboard

---

## Contact & Support

**Agent 1 (Payments):** Alex (Architect), Sam (Senior Dev), Jamie (Junior Dev)
**Agent 2 (QR):** Alex (Architect), Sam (Senior Dev), Jamie (Junior Dev)

**Documentation:**
- Payments: `backend/PAYMENTS_IMPLEMENTATION_COMPLETE.md`
- QR: `SESSION_NOTES_QR_IMPROVEMENTS_2026-01-27.md`

**Questions?** Review implementation docs or ask in team chat.

---

**Status:** ⏳ Ready for Integration Testing
**Next Milestone:** Production Deployment

**Last Updated:** 2026-01-27
