# Phase 6 - Production Deployment Guide

**Date:** 2026-01-27
**Team:** Team 1 (Status Levels)
**Phase:** 6 - Production Deployment Ready

---

## Deployment Overview

### What's Being Deployed
1. ✅ Status Levels Backend API (Phases 1-2)
2. ✅ Status Levels Frontend UI (Phase 3)
3. ✅ Cron Job for Expiring Status Checks (Phase 4)

### Deployment Targets
- **Backend:** Railway (existing service)
- **Frontend:** Already deployed (Vite build)
- **Cron Job:** Railway Cron (new configuration)
- **Database:** Supabase (migrations already applied)

---

## Pre-Deployment Checklist

### Database (Supabase)
- [x] Migration 0027 applied (core tables)
- [x] Migration 0028 applied (RLS policies)
- [x] Migration 0029 applied (SQL functions)
- [x] Migration 0030 applied (QR timeline index)
- [ ] Verify migrations in production:
  ```sql
  SELECT * FROM schema_migrations
  WHERE version IN ('0027', '0028', '0029', '0030')
  ORDER BY version;
  ```
- [ ] Verify tables exist:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name LIKE '%status%'
  ORDER BY table_name;
  ```

### Backend (Railway)
- [ ] Environment variables configured:
  - `DATABASE_URL` (Supabase connection string)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SESSION_COOKIE_NAME`
  - `SESSION_SECRET_KEY`
- [ ] Code deployed to main branch
- [ ] Service healthy (no crashes)
- [ ] API endpoints responding:
  - `GET /api/status-levels/info` (200 OK)
  - `GET /api/organizations/{org_id}/status` (200 OK)

### Frontend
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] No console errors in production build
- [ ] Pages accessible:
  - `/levels` (Status Levels info page)
  - `/dashboard/organization/status` (Org status dashboard)

### Cron Job
- [ ] File deployed: `backend/app/cron/checkExpiringStatuses.py`
- [ ] Syntax validated: `python -m py_compile`
- [ ] Dependencies installed in Railway
- [ ] Imports working (no ModuleNotFoundError)

---

## Railway Cron Configuration

### Step-by-Step Setup

#### 1. Access Railway Dashboard
- Go to https://railway.app
- Select your project
- Select backend service

#### 2. Configure Cron Schedule
- Navigate to **Settings** tab
- Scroll to **Cron Schedule** section
- Click **Add Cron Job** (or edit existing)

#### 3. Enter Cron Expression
```
0 2 * * *
```
**Explanation:** Daily at 02:00 UTC
- `0` = minute (0)
- `2` = hour (2 AM)
- `*` = every day of month
- `*` = every month
- `*` = every day of week

#### 4. Set Start Command
```bash
python -m app.cron.checkExpiringStatuses
```

**Important:** Use module execution (`-m`) not file path

#### 5. Save Configuration
- Click **Save**
- Cron job will run on next scheduled time (02:00 UTC)

#### 6. Verify Configuration
- Check Railway dashboard shows cron schedule
- Wait for next execution OR trigger manually:
  ```bash
  railway run python -m app.cron.checkExpiringStatuses
  ```

---

## Cron Job Testing in Production

### First Execution Monitoring

**Schedule first run for testing:**
1. Set cron to run in 10 minutes: `{current_minute+10} {current_hour} * * *`
2. Example: If current time is 14:30 UTC, use: `40 14 * * *`
3. Wait 10 minutes
4. Check logs

**What to Look For:**
```
================================================================================
Starting expiring status check (Daily @ 02:00 UTC)
Run time: 2026-01-27T14:40:00.123456
================================================================================

Checking statuses expiring in 60 days...
Found 2 status(es) expiring in 60 days
[SKELETON] Would send notification: Org {...} level B expires in 60 days
[SKELETON] Would send notification: Org {...} level A expires in 60 days

Checking statuses expiring in 30 days...
Found 0 status(es) expiring in 30 days

Checking statuses expiring in 7 days...
Found 1 status(es) expiring in 7 days
[SKELETON] Would send notification: Org {...} level B expires in 7 days

Checking statuses expiring in 1 days...
Found 0 status(es) expiring in 1 days

================================================================================
Expiring status check complete: 3 total found
================================================================================
Cron job completed successfully
```

**Success Indicators:**
- ✅ All 4 threshold checks completed
- ✅ "Cron job completed successfully" logged
- ✅ Exit code 0
- ✅ No error messages

**After Test:**
1. Update cron schedule to production: `0 2 * * *`
2. Save configuration
3. Verify in dashboard

---

## Monitoring Setup

### Railway Logs
**Access:** Railway Dashboard → Service → Logs tab

**Filter for cron jobs:**
- Search: "Starting expiring status check"
- Set time range: Last 7 days
- Enable auto-refresh

**Daily Verification:**
- Check logs each morning for previous night's run (02:00 UTC)
- Verify "completed successfully" message
- Check status counts are reasonable

### Log Retention
Railway retains logs for:
- **Free tier:** 24-48 hours
- **Paid tier:** 7-30 days (check your plan)

**Archive Important Logs:**
If you need longer retention:
1. Set up log forwarding (Papertrail, Datadog, etc.)
2. Or manually export weekly

### Alerting Configuration

**Option 1: Railway Webhooks**
Configure Railway to send webhook on cron failure:
- Dashboard → Settings → Webhooks
- Add webhook URL (your monitoring service)
- Select events: "Deployment failed", "Service crashed"

**Option 2: External Monitoring**
Use cron monitoring service:
- **Cronitor** (https://cronitor.io)
- **Healthchecks.io** (https://healthchecks.io)
- **Better Uptime** (https://betteruptime.com)

Example with Healthchecks.io:
```python
# Add to end of check_expiring_statuses()
import requests
requests.get("https://hc-ping.com/{your-uuid}")
```

---

## Production Deployment Steps

### Step 1: Final Code Review (15 minutes)
- [ ] Review all changed files in git
- [ ] Check for console.log / debug statements
- [ ] Verify no hardcoded credentials
- [ ] Confirm .env files not committed

### Step 2: Database Verification (10 minutes)
- [ ] Run migration verification queries
- [ ] Check RLS policies active
- [ ] Test SQL functions in production DB
- [ ] Backup database (Supabase dashboard)

### Step 3: Backend Deployment (20 minutes)
- [ ] Merge feature branch to main:
  ```bash
  git checkout main
  git merge feature/status-levels --no-ff
  git push origin main
  ```
- [ ] Railway auto-deploys on push to main
- [ ] Wait for deployment to complete
- [ ] Check Railway logs for startup errors
- [ ] Test API endpoints:
  ```bash
  curl https://api.chestno.ru/api/status-levels/info
  curl https://api.chestno.ru/api/organizations/{test_org_id}/status
  ```

### Step 4: Frontend Deployment (15 minutes)
- [ ] Frontend typically auto-deploys with backend OR
- [ ] Trigger manual build if separate:
  ```bash
  cd frontend
  npm run build
  # Deploy dist/ to hosting (Vercel/Netlify)
  ```
- [ ] Verify pages load:
  - https://chestno.ru/levels
  - https://chestno.ru/dashboard/organization/status
- [ ] Check StatusBadge displays on organization pages
- [ ] Verify no console errors

### Step 5: Cron Job Configuration (15 minutes)
- [ ] Follow Railway Cron Configuration steps above
- [ ] Set schedule: `0 2 * * *`
- [ ] Set command: `python -m app.cron.checkExpiringStatuses`
- [ ] Save configuration
- [ ] Trigger test run (optional):
  ```bash
  railway run python -m app.cron.checkExpiringStatuses
  ```

### Step 6: Smoke Testing (20 minutes)
- [ ] **Test 1:** Public status levels info
  - Visit /levels page
  - Verify all sections render
  - Check mobile responsive

- [ ] **Test 2:** Organization status (authenticated)
  - Login as org admin
  - Visit /dashboard/organization/status
  - Verify current status displays
  - Check upgrade request form

- [ ] **Test 3:** Admin operations (platform admin)
  - Login as platform admin
  - Grant Level B to test org
  - Verify appears in org dashboard
  - Revoke Level B
  - Verify removed from org dashboard

- [ ] **Test 4:** Status history
  - Check history shows grant/revoke events
  - Verify pagination works
  - Check timestamps correct

- [ ] **Test 5:** API integration
  - Test GET /api/organizations/{id}/status
  - Test POST upgrade request
  - Test admin grant/revoke endpoints

### Step 7: Monitoring Verification (10 minutes)
- [ ] Check Railway logs accessible
- [ ] Verify cron schedule visible in dashboard
- [ ] Set up alerts (if using external service)
- [ ] Document monitoring URLs for team

---

## Post-Deployment Verification

### First 24 Hours
- [ ] Monitor Railway logs for errors
- [ ] Check cron job ran at 02:00 UTC (next day)
- [ ] Verify database queries executing correctly
- [ ] Check API response times normal
- [ ] Monitor error rates in Sentry (if configured)

### First Week
- [ ] Daily cron job check (7 days)
- [ ] Review status level grant/revoke activity
- [ ] Check upgrade request volume
- [ ] Monitor database performance
- [ ] Collect user feedback

### First Month
- [ ] Weekly cron job summary
- [ ] Review expiring status trends
- [ ] Analyze API usage patterns
- [ ] Identify optimization opportunities
- [ ] Plan Phase 5 notification implementation

---

## Rollback Procedures

### If Backend Deployment Fails
```bash
# Revert to previous deployment
railway rollback

# Or redeploy previous commit
git revert HEAD
git push origin main
```

### If Cron Job Causes Issues
1. **Disable Immediately:**
   - Railway Dashboard → Settings → Cron Schedule
   - Delete cron job entry
   - Click Save

2. **Investigate:**
   - Download logs
   - Check database for issues
   - Test locally with production data snapshot

3. **Fix and Redeploy:**
   - Fix issue in code
   - Test in staging
   - Reconfigure cron job

### If Database Migration Issues
**NEVER rollback migrations in production without backup!**

1. Take immediate backup (Supabase dashboard)
2. Assess impact (read-only queries safe)
3. If critical: Restore from backup
4. If minor: Create forward migration to fix

---

## Success Metrics

### Deployment Success
- ✅ All services healthy
- ✅ Zero critical errors in first 24 hours
- ✅ Cron job executes successfully
- ✅ API response times < 500ms (p95)
- ✅ Frontend pages load in < 2s

### Feature Adoption (Week 1)
- Organizations viewing /levels page
- Upgrade requests created
- Admin grant/revoke operations
- StatusBadge impressions

### System Health (Week 1)
- Cron job success rate: 100% (7/7 runs)
- API error rate: < 0.1%
- Database query performance: < 100ms avg
- Zero data corruption incidents

---

## Known Issues & Workarounds

### Issue 1: Cron job doesn't execute
**Symptom:** No logs at 02:00 UTC
**Cause:** Cron schedule not saved or incorrect syntax
**Fix:**
- Verify cron schedule in Railway dashboard
- Check command syntax: `python -m app.cron.checkExpiringStatuses`
- Manually trigger to test: `railway run python -m app.cron.checkExpiringStatuses`

### Issue 2: Database connection timeout in cron
**Symptom:** "Database connection failed" in logs
**Cause:** Railway cold start or connection pool exhausted
**Fix:**
- Add retry logic (future enhancement)
- Increase database connection timeout
- Use connection pooling

### Issue 3: StatusBadge not displaying
**Symptom:** Badge doesn't show on org pages
**Cause:** API call failing or RLS policy blocking
**Fix:**
- Check browser console for API errors
- Verify user has permission to view org
- Check RLS policies allow public access to status

---

## Communication Plan

### Stakeholder Notifications

**Before Deployment:**
- [ ] Notify team in #mvp-sprint channel
- [ ] Announce maintenance window (if any downtime)
- [ ] Share deployment timeline

**After Deployment:**
- [ ] Post success message:
  ```
  ✅ Status Levels Phase 4-6 deployed to production!

  Features live:
  - Status Levels API (grant/revoke)
  - Frontend pages (/levels, /dashboard/organization/status)
  - Daily cron job for expiring status checks

  Monitor: Railway logs at 02:00 UTC daily
  Issues: Report in #mvp-sprint
  ```

**Handoff to Team 3:**
- [ ] Post in #mvp-sprint:
  ```
  ✅ Status Levels Phase 4-6 complete. @Team3 you're unblocked for Payments.

  Integration points available:
  - grant_status_level(org_id, level, subscription_id)
  - revoke_status_level(org_id, level, reason)
  - handle_subscription_status_change(subscription_id, new_status, org_id)

  Documentation: backend/docs/STATUS_LEVELS_SUBSCRIPTION_INTEGRATION.md
  ```

---

## Documentation Updates

### Update These Files Post-Deployment:
- [ ] README.md - Add Status Levels section
- [ ] API_DOCS.md - Document new endpoints
- [ ] CHANGELOG.md - Add Phase 4-6 release notes
- [ ] SPRINT_PROGRESS.md - Mark Status Levels complete

### Create These Files:
- [ ] STATUS_LEVELS_USER_GUIDE.md - For end users
- [ ] STATUS_LEVELS_ADMIN_GUIDE.md - For platform admins
- [ ] CRON_JOB_MONITORING.md - Operations guide

---

## Phase 6 Completion Checklist

- [x] Production deployment guide created
- [x] Railway cron configuration documented
- [x] Monitoring strategy defined
- [x] Rollback procedures documented
- [x] Success metrics established
- [x] Communication plan ready
- [ ] Backend deployed to production
- [ ] Frontend deployed to production
- [ ] Cron job configured in Railway
- [ ] Smoke tests passed
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment
- [ ] Team 3 handoff complete

---

## Next Steps (Post-Deployment)

### Immediate (Week 1)
1. Monitor daily cron execution
2. Respond to any production issues
3. Collect early user feedback
4. Track adoption metrics

### Short-term (Weeks 2-4)
1. Optimize based on monitoring data
2. Fix any reported bugs
3. Begin Phase 5 planning (notifications)
4. Support Team 3 (Payments integration)

### Long-term (Month 2+)
1. Implement Phase 5 (email notifications)
2. Add in-app notification system
3. Create analytics dashboard
4. Plan Level C auto-grant automation

---

**Phase 6 Status:** ✅ READY FOR PRODUCTION
**Deployment Date:** TBD (awaiting approval)
**Team:** Team 1 Complete
**Handoff:** Ready for Team 3 (Payments)
