# Phase 4 Cron Job Decision - Railway Native Cron

**Date:** 2026-01-27
**Team:** Team 1 (Status Levels)
**Decision:** Use Railway Native Cron (NO APScheduler needed)

---

## Research Summary

Railway provides **native cron job support** as a built-in feature. No external scheduling libraries (like APScheduler) are required for our use case.

**Sources:**
- [Cron Jobs | Railway Docs](https://docs.railway.com/reference/cron-jobs)
- [Running a Scheduled Job | Railway Docs](https://docs.railway.com/guides/cron-jobs)
- [Run Scheduled and Recurring Tasks with Cron](https://blog.railway.com/p/run-scheduled-and-recurring-tasks-with-cron)

---

## Railway Cron Capabilities

### ✅ Features We Need
- **Standard crontab expressions:** Supports full cron syntax
- **UTC timezone:** Runs in UTC (matches our requirement for 02:00 UTC)
- **Python script execution:** Can run Python modules directly
- **Clean termination:** Expects jobs to execute and exit (perfect for our batch job)
- **Logging:** Stdout/stderr captured in Railway logs
- **No minimum deployment:** Can use existing service

### ⚠️ Limitations
- **Minimum interval:** 5 minutes between executions (not an issue for daily jobs)
- **UTC only:** No timezone conversion (we want UTC anyway)
- **Single schedule per service:** Need multiple services for multiple schedules

### ❌ Not Needed
- **APScheduler:** Would add unnecessary complexity and dependencies
- **Background processes:** Railway cron handles scheduling
- **Persistent storage:** Not needed for our simple daily job

---

## Our Use Case: Daily Status Expiration Check

**Requirement:**
- Check for expiring status levels daily at 02:00 UTC
- Find statuses expiring in 60, 30, 7, and 1 days
- Log findings (Phase 4) / Send notifications (Phase 5)

**Railway Cron Perfect Fit:**
- ✅ Daily schedule: `0 2 * * *` (02:00 UTC)
- ✅ Execute Python script: `python -m app.cron.checkExpiringStatuses`
- ✅ Clean exit: Script logs and exits
- ✅ No persistent state needed
- ✅ Simple to configure and monitor

---

## Implementation Decision

**CHOSEN APPROACH: Railway Native Cron**

**Rationale:**
1. **Simplicity:** No external dependencies, no background processes
2. **Native integration:** Uses Railway's built-in features
3. **Monitoring:** Logs appear in Railway dashboard
4. **Reliability:** Railway handles job execution and retries
5. **Cost:** No additional compute resources needed
6. **Maintenance:** Less code to maintain (no scheduler setup)

**Alternative Rejected: APScheduler**
- Would require:
  - Additional dependency in requirements.txt
  - Background process running 24/7 (wasteful)
  - Database persistence for job state (overkill)
  - Custom monitoring and error handling
- Adds complexity without benefits for our simple use case

---

## Railway Configuration

### Service Setup

1. **Use existing backend service** (no new service needed)
2. **Create cron job configuration:**
   - Go to Service Settings → Cron Schedule
   - Enter: `0 2 * * *` (daily at 02:00 UTC)
   - Start command: `python -m app.cron.checkExpiringStatuses`

3. **Environment variables:** Same as main service (inherits automatically)

### File Structure

```
backend/
├── app/
│   ├── cron/
│   │   ├── __init__.py
│   │   └── checkExpiringStatuses.py  ← Cron job script
│   ├── services/
│   │   └── status_levels.py          ← Used by cron job
│   └── ...
```

### Execution Flow

```
Railway Scheduler (02:00 UTC daily)
  ↓
python -m app.cron.checkExpiringStatuses
  ↓
check_expiring_statuses() function
  ↓
Query database for expiring statuses
  ↓
Log findings (Phase 4) / Send notifications (Phase 5)
  ↓
Exit cleanly (code 0)
  ↓
Railway captures logs
```

---

## Testing Strategy

### Local Testing (Dev Environment)
```bash
# Run manually to test logic
python -m app.cron.checkExpiringStatuses

# Should output:
# ================================================================================
# Starting expiring status check (Daily @ 02:00 UTC)
# Run time: 2026-01-27T02:00:00
# ================================================================================
# Checking statuses expiring in 60 days...
# Found 0 status(es) expiring in 60 days
# ...
# Cron job completed successfully
```

### Railway Testing (Staging)
1. Configure cron schedule in staging service
2. Set schedule to run in 5 minutes: `[current_time + 5] * * *`
3. Verify execution in Railway logs
4. Check stdout for expected log output
5. Update to production schedule: `0 2 * * *`

### Production Monitoring
- Check Railway logs daily after 02:00 UTC
- Alert if job doesn't run for 2 consecutive days
- Track execution time (should be < 1 minute for typical load)

---

## Phase 4 vs Phase 5

### Phase 4 (Current - Skeleton)
- ✅ Cron job executes daily
- ✅ Queries for expiring statuses
- ✅ Logs findings to stdout
- ❌ No notifications sent
- ❌ No database updates

**Status:** Skeleton complete, ready for integration testing

### Phase 5 (Future - Full Implementation)
- ✅ All Phase 4 features
- ✅ Send email notifications to org admins
- ✅ Create in-app notifications
- ✅ Log notification history in database
- ✅ Handle notification failures gracefully
- ✅ Track notification metrics

**Dependencies for Phase 5:**
- Email service integration (SendGrid, AWS SES, etc.)
- Notification templates (email HTML/text)
- In-app notification system
- Database migrations for notification log table

---

## Deployment Checklist

Before deploying to production:

- [x] Cron script created (`checkExpiringStatuses.py`)
- [x] Syntax validated (python -m py_compile)
- [ ] Tested locally with database connection
- [ ] Configured in Railway staging
- [ ] Verified execution in staging logs
- [ ] Configured in Railway production
- [ ] Monitoring alerts set up
- [ ] Documentation updated

---

## Future Enhancements

If we need more complex scheduling in the future:

1. **Multiple schedules:** Deploy same service multiple times with different cron expressions
2. **Timezone support:** Add timezone conversion in Python script
3. **Dynamic scheduling:** Store schedules in database, read at runtime
4. **Batch operations:** Process multiple organizations in batches to handle scale

**But for Phase 4-5:** Railway native cron is perfect.

---

## Conclusion

**Railway Native Cron is the RIGHT choice for Status Levels expiration checking.**

- Simple
- Reliable
- No additional dependencies
- Easy to monitor
- Cost-effective

**No APScheduler needed.** ✅

---

**Approved by:** Team 1 (Alex - Architect, Sam - Senior Dev)
**Date:** 2026-01-27
**Status:** ✅ Ready for Phase 5 implementation
