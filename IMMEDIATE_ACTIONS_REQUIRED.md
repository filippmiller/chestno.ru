# Immediate Actions Required

**Date:** 2026-01-27
**Priority:** HIGH
**Status:** 🚨 Action Required Before Deployment

---

## Critical Issue: Migration Conflict - RESOLVED ✅

**Problem:** Both agents created migration `0031` causing a conflict.
**Solution Applied:** Removed duplicate `0031_qr_timeline_index.sql`

**Current migration sequence:**
```
✅ 0030_qr_timeline_index.sql       (QR timeline index)
✅ 0031_payments_integration.sql    (Payments integration)
✅ 0032_qr_customization.sql        (QR customization)
```

---

## Step-by-Step Action Plan

### STEP 1: Verify Dependencies ⏳

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```

**Verify yookassa installed:**
```bash
pip list | grep yookassa
```

**Frontend:**
```bash
cd frontend
npm install
```

**Verify recharts and react-colorful:**
```bash
npm list recharts react-colorful
```

**Expected output:**
- `recharts@^2.x.x`
- `react-colorful@^5.x.x`

---

### STEP 2: Environment Configuration ⏳

**Create/Update `.env` file:**
```bash
# Copy example if not exists
cp .env.example .env
```

**Add YooKassa credentials (Sandbox):**
```env
# YooKassa Payment Integration
YUKASSA_SHOP_ID=your_sandbox_shop_id
YUKASSA_SECRET_KEY=your_sandbox_secret_key
YUKASSA_WEBHOOK_SECRET=your_webhook_secret
YUKASSA_SANDBOX_MODE=True
PAYMENT_CURRENCY=RUB
PAYMENT_RETURN_URL=http://localhost:5173/subscription/success
PAYMENT_CANCEL_URL=http://localhost:5173/subscription/canceled
```

**Get credentials:**
1. Sign up at https://yookassa.ru
2. Navigate to Settings → API Keys (Sandbox)
3. Copy Shop ID and Secret Key
4. Generate webhook secret (or use provided)

---

### STEP 3: Database Migrations ⏳

**Apply migrations:**
```bash
# Check current status
npx supabase db diff

# Apply all pending migrations
npx supabase db push
```

**Verify migrations applied:**
```bash
# Check tables exist
npx supabase db execute <<SQL
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'payment_transactions',
  'payment_webhooks_log',
  'subscription_retry_attempts',
  'qr_customization_settings'
);
SQL
```

**Expected output:**
- payment_transactions
- payment_webhooks_log
- subscription_retry_attempts
- qr_customization_settings

---

### STEP 4: Create Supabase Storage Bucket ⏳

**Manual step (cannot be automated):**

1. **Login to Supabase Dashboard:**
   - Go to https://supabase.com
   - Select your project

2. **Create Bucket:**
   - Navigate to Storage → Buckets
   - Click "New Bucket"
   - Name: `qr-logos`
   - Public: No (controlled by RLS)
   - Click "Create Bucket"

3. **Verify RLS Policies:**
   - Click on `qr-logos` bucket
   - Settings → Policies
   - Should have policies from migration 0032

---

### STEP 5: Run Tests ⏳

**Backend Unit Tests:**
```bash
cd backend

# Payments tests
pytest tests/test_payment_service.py -v
pytest tests/test_webhook_service.py -v

# QR tests
pytest tests/test_qr_contrast.py -v
pytest tests/test_qr_service.py -v

# All tests
pytest tests/ -v --tb=short
```

**Expected:** All tests pass ✅

---

### STEP 6: Start Development Servers ⏳

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Webhook Tunnel (for payment testing):**
```bash
# Install ngrok if not installed
npm install -g ngrok

# Start tunnel
ngrok http 8000
```

**Copy ngrok HTTPS URL** (e.g., `https://abc123.ngrok.io`)

---

### STEP 7: Register Webhook in YooKassa ⏳

**Manual step:**

1. **Login to YooKassa Dashboard:**
   - Go to https://yookassa.ru
   - Select Sandbox mode

2. **Register Webhook:**
   - Navigate to Settings → Webhooks
   - Click "Add Webhook"
   - URL: `https://abc123.ngrok.io/api/webhooks/yukassa`
   - Events to subscribe:
     - ✅ payment.succeeded
     - ✅ payment.failed
     - ✅ payment.canceled
   - Click "Add"

3. **Test Webhook:**
   - Click "Test" button in YooKassa dashboard
   - Check backend logs for webhook received

---

### STEP 8: Manual Testing ⏳

**Payments Flow:**
1. Navigate to subscription plans page
2. Select Level A plan
3. Click "14 days free trial"
4. Should redirect to YooKassa payment page
5. Use test card: `1111 1111 1111 1026`
6. Complete payment (1₽)
7. Verify:
   - [ ] Redirected to success page
   - [ ] Level A granted (check database)
   - [ ] 1₽ refunded (check YooKassa)
   - [ ] Webhook received (check backend logs)

**QR Timeline:**
1. Navigate to Organization QR codes
2. Click "Показать детали" on any QR code
3. Click "Timeline" tab
4. Verify:
   - [ ] Chart renders
   - [ ] Can switch periods (7d, 30d, 90d, 1y)
   - [ ] Hover shows tooltip with date and count

**QR Customization:**
1. Click "Настроить вид" button
2. Change foreground color
3. Change background color
4. Verify:
   - [ ] Live preview updates
   - [ ] Contrast ratio calculated
   - [ ] Warning shows if contrast < 3.0
   - [ ] Save button disabled for invalid contrast

**QR Batch Operations:**
1. Click "Массовое создание"
2. Enter multiple labels (one per line)
3. Verify:
   - [ ] Preview table shows all codes
   - [ ] Quota check works
   - [ ] Creates all codes on submit
4. Click "Выбрать несколько"
5. Select multiple QR codes
6. Click "Export" button
7. Verify:
   - [ ] ZIP file downloads
   - [ ] Contains all selected QR codes as PNG

---

### STEP 9: Git Commit & Cleanup ⏳

**Review git status:**
```bash
git status
```

**Many deleted files - decide what to do:**
- `CLAUDE.md`, `README.md`, etc. are deleted
- Check if these were intentional deletions
- Restore if needed: `git restore CLAUDE.md`

**Stage and commit:**
```bash
# Stage new files
git add .

# Review changes
git diff --staged

# Commit
git commit -m "feat: payments integration + QR improvements

- Add YooKassa payment integration (trial, subscription, webhooks)
- Add QR timeline analytics with recharts
- Add QR customization (colors, WCAG validation)
- Add QR batch operations (bulk create, ZIP export)
- Fix: Remove duplicate migration 0031_qr_timeline_index.sql

Co-Authored-By: Agent 1 (Payments) <noreply@anthropic.com>
Co-Authored-By: Agent 2 (QR) <noreply@anthropic.com>"
```

---

### STEP 10: Production Deployment Planning ⏳

**Do NOT deploy to production yet.**

Complete checklist before production:
- [ ] All tests pass
- [ ] Manual testing complete
- [ ] Integration testing complete
- [ ] Environment variables set in Railway
- [ ] YooKassa production credentials obtained
- [ ] Production webhook registered
- [ ] Database backup created
- [ ] Rollback plan documented

**See:** `INTEGRATION_PLAN_2026-01-27.md` for full deployment checklist

---

## Quick Verification Commands

**Check if everything is ready:**

```bash
# 1. Dependencies installed?
pip list | grep yookassa && echo "✅ yookassa installed" || echo "❌ Missing yookassa"
npm list recharts react-colorful && echo "✅ Frontend deps installed" || echo "❌ Missing frontend deps"

# 2. Migrations applied?
npx supabase db diff && echo "✅ No pending migrations" || echo "❌ Migrations pending"

# 3. Environment configured?
grep YUKASSA_SHOP_ID .env && echo "✅ YooKassa configured" || echo "❌ Missing YooKassa config"

# 4. Storage bucket exists?
# (Manual check in Supabase dashboard)

# 5. Tests passing?
cd backend && pytest tests/ -q && echo "✅ Tests pass" || echo "❌ Tests fail"
```

---

## Troubleshooting

### Issue: yookassa not found
**Solution:**
```bash
cd backend
pip install yookassa
```

### Issue: Migration failed
**Solution:**
```bash
# Check error message
npx supabase db push

# If constraint error, check existing data
# May need to update migration with IF NOT EXISTS
```

### Issue: Webhook not received
**Solution:**
1. Check ngrok is running
2. Verify URL in YooKassa dashboard matches ngrok URL
3. Check backend logs for errors
4. Verify webhook secret matches .env

### Issue: Tests fail
**Solution:**
```bash
# Run with verbose output
pytest tests/ -vv --tb=short

# Check specific test
pytest tests/test_payment_service.py::test_name -vv
```

### Issue: Storage bucket RLS error
**Solution:**
1. Verify bucket created in Supabase dashboard
2. Check RLS policies applied from migration 0032
3. May need to manually apply policies if migration skipped them

---

## Success Criteria

**Ready for Production When:**
- ✅ All dependencies installed
- ✅ All migrations applied successfully
- ✅ All tests pass (backend unit tests)
- ✅ Storage bucket created and configured
- ✅ Manual testing checklist complete (all items checked)
- ✅ Integration testing complete (payments + QR work together)
- ✅ Git committed and pushed
- ✅ Documentation reviewed and understood

**Current Status:** 🚨 Action Required

**Next Steps:** Follow STEP 1-10 above

---

**Last Updated:** 2026-01-27
**See Also:** `INTEGRATION_PLAN_2026-01-27.md` for detailed deployment plan
