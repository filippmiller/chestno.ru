# Testing Plan: Iteration 3 Features

**Version:** 1.0
**Date:** 2026-02-01
**Features:** Gamification, Rewards, Retail, Moderation

---

## 1. QR Gamification System Tests

### 1.1 Tier System

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAM-001 | Get tiers (unauthenticated) | GET `/api/gamification/tiers` | Returns 4 tiers with thresholds |
| GAM-002 | New user profile | Register → GET `/api/gamification/profile` | Shows tier: "none", points: 0 |
| GAM-003 | First scan | POST `/api/gamification/scan` with product_id | Points awarded, scan recorded |
| GAM-004 | Bronze tier upgrade | Complete 5 scans | Profile shows tier: "bronze" |
| GAM-005 | Silver tier upgrade | Complete 20 scans | Profile shows tier: "silver" |
| GAM-006 | Gold tier upgrade | Complete 50 scans | Profile shows tier: "gold" |
| GAM-007 | Tier bonus calculation | Scan as Gold user | Points include +50% bonus |

### 1.2 Achievements

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAM-010 | List all achievements | GET `/api/gamification/achievements` | Returns all + earned + available |
| GAM-011 | First scan achievement | Complete first scan | "First Scan" achievement unlocked |
| GAM-012 | Mark achievement seen | POST `/api/gamification/achievements/mark-seen` | seen_at timestamp set |
| GAM-013 | Achievement progress | GET achievements after 3 scans | Progress shows 3/5 for Bronze |

### 1.3 Leaderboard

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAM-020 | All-time leaderboard | GET `/api/gamification/leaderboard?period=all_time` | Sorted by total scans |
| GAM-021 | Monthly leaderboard | GET `/api/gamification/leaderboard?period=monthly` | Shows current month only |
| GAM-022 | Weekly leaderboard | GET `/api/gamification/leaderboard?period=weekly` | Shows current week only |
| GAM-023 | User position | GET leaderboard as authenticated user | Response includes user's rank |

### 1.4 Scan History

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAM-030 | Get scan history | GET `/api/gamification/history` | Returns user's scans |
| GAM-031 | Pagination | GET `/api/gamification/history?limit=5&offset=10` | Returns correct page |
| GAM-032 | Scan with location | POST scan with lat/lng/city | Location saved in history |

---

## 2. Review Rewards System Tests

### 2.1 Points Calculation

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| REW-001 | Get config | GET `/api/rewards/config` | Returns points rules |
| REW-002 | Minimum review | POST `/api/rewards/calculate` (30 words, no media) | 10 base points |
| REW-003 | 100+ words bonus | POST calculate (100 words) | 10 + 10 = 20 points |
| REW-004 | 200+ words bonus | POST calculate (200 words) | 10 + 25 = 35 points |
| REW-005 | 400+ words bonus | POST calculate (400 words) | 10 + 50 = 60 points |
| REW-006 | Photo bonus | POST calculate (1 photo) | 10 + 15 = 25 points |
| REW-007 | Max photos | POST calculate (5 photos) | Only 3 counted: 10 + 45 |
| REW-008 | Video bonus | POST calculate (with video) | 10 + 30 = 40 points |
| REW-009 | Verified purchase | POST calculate (verified=true) | 10 + 20 = 30 points |
| REW-010 | Combined bonuses | 200 words + 2 photos + verified | 10 + 25 + 30 + 20 = 85 |

### 2.2 Rate Limiting

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| REW-020 | Check rate limit | GET `/api/rewards/me/rate-limit` | Shows remaining daily/weekly |
| REW-021 | Daily limit | Submit 5 reviews in one day | 6th review blocked |
| REW-022 | Weekly limit | Submit 20 reviews in one week | 21st review blocked |
| REW-023 | Account age check | New account (<3 days) submits review | Points not awarded |

### 2.3 Partners & Catalog

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| REW-030 | List partners | GET `/api/rewards/partners` | Returns 5+ partners |
| REW-031 | Filter by category | GET `/api/rewards/partners?category=education` | Only education partners |
| REW-032 | Get catalog | GET `/api/rewards/catalog` | Returns available rewards |
| REW-033 | Affordable filter | GET `/api/rewards/catalog?affordable_only=true` | Only rewards user can afford |

### 2.4 Redemption

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| REW-040 | Redeem reward | POST `/api/rewards/redeem` with reward_id | Voucher code generated |
| REW-041 | Insufficient points | Try to redeem expensive reward | Error: insufficient points |
| REW-042 | Points deducted | Check balance after redemption | Points correctly reduced |
| REW-043 | Redemption history | GET `/api/rewards/me/redemptions` | Shows all vouchers |
| REW-044 | Voucher details | GET `/api/rewards/me/voucher/{id}` | Returns code + instructions |
| REW-045 | Redemption limit | Exceed per-user limit | Error: limit reached |

### 2.5 User Dashboard

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| REW-050 | Get overview | GET `/api/rewards/me/overview` | Full dashboard data |
| REW-051 | Points balance | Check current_points in overview | Matches transaction sum |
| REW-052 | Lifetime points | Check lifetime_points | Total ever earned |
| REW-053 | Suggested rewards | Check suggested_rewards | Based on current balance |

---

## 3. Retail Staff Management Tests

### 3.1 Store Management

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RET-001 | Create store | POST `/api/retail/stores` | Store created with ID |
| RET-002 | List stores | GET `/api/retail/stores` | Returns org's stores |
| RET-003 | Get store details | GET `/api/retail/stores/{id}` | Full store info |
| RET-004 | Update store | PATCH `/api/retail/stores/{id}` | Store updated |

### 3.2 Staff Management

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RET-010 | Add staff | POST `/api/retail/stores/{id}/staff` | Staff linked to store |
| RET-011 | List store staff | GET `/api/retail/stores/{id}/staff` | Returns staff list |
| RET-012 | Staff certification | Update staff certification_level | Level saved |
| RET-013 | Remove staff | DELETE `/api/retail/staff/{id}` | Staff removed |

### 3.3 Performance Tracking

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RET-020 | Record assist | POST customer assist | Assist count incremented |
| RET-021 | Staff leaderboard | GET `/api/retail/staff/leaderboard` | Ranked by performance |
| RET-022 | Store leaderboard | GET `/api/retail/stores/leaderboard` | Ranked by total assists |

---

## 4. Content Moderation Tests

### 4.1 Queue Management

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| MOD-001 | List queue | GET `/api/moderation/queue` | Returns pending items |
| MOD-002 | Filter by type | GET `/api/moderation/queue?content_type=review` | Only reviews |
| MOD-003 | Filter by priority | GET `/api/moderation/queue?priority=urgent` | Only urgent items |
| MOD-004 | Filter by status | GET `/api/moderation/queue?status=pending` | Only pending |
| MOD-005 | Pagination | GET queue with limit/offset | Correct page returned |

### 4.2 Moderation Actions

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| MOD-010 | Approve item | POST action with action=approve | Status → approved |
| MOD-011 | Reject item | POST action with action=reject | Status → rejected |
| MOD-012 | Escalate item | POST action with action=escalate | Status → escalated |
| MOD-013 | Request changes | POST action with action=request_changes | Status → pending, notes added |
| MOD-014 | Action audit trail | Check moderation_actions table | Action logged with moderator |

### 4.3 Statistics

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| MOD-020 | Queue stats | GET `/api/moderation/stats` | Counts by status/type |
| MOD-021 | Moderator stats | GET `/api/moderation/moderators` | Performance by moderator |
| MOD-022 | Average response time | Check stats after actions | Time calculated correctly |

### 4.4 Authorization

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| MOD-030 | Non-admin access | Regular user tries GET queue | 403 Forbidden |
| MOD-031 | Admin access | Admin user GET queue | 200 OK |
| MOD-032 | Moderator role | User with moderator role | Can access queue |

---

## 5. Integration Tests

### 5.1 Cross-Feature Integration

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| INT-001 | Review → Points | Submit review | Points awarded to user |
| INT-002 | Review → Moderation | Submit review | Appears in moderation queue |
| INT-003 | Scan → Gamification | Scan QR code | Updates profile + history |
| INT-004 | Staff assist → Scan | Staff assists customer scan | Both records created |

### 5.2 Authentication Flow

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| INT-010 | Valid JWT | Request with valid Supabase token | Authenticated |
| INT-011 | Expired JWT | Request with expired token | 401 Unauthorized |
| INT-012 | Invalid JWT | Request with malformed token | 401 Unauthorized |
| INT-013 | Optional auth | GET leaderboard without token | Returns data (no user rank) |

---

## 6. Performance Tests

| Test ID | Test Case | Target | Method |
|---------|-----------|--------|--------|
| PERF-001 | Tiers endpoint | <100ms | Load test 100 concurrent |
| PERF-002 | Leaderboard | <500ms | 1000+ users in DB |
| PERF-003 | Scan recording | <200ms | Includes tier calculation |
| PERF-004 | Points calculation | <50ms | Complex review |
| PERF-005 | Moderation queue | <300ms | 1000+ pending items |

---

## 7. Test Execution Commands

### Manual API Testing (curl)

```bash
# Health check
curl https://chestnoru-production.up.railway.app/api/health/

# Gamification tiers (public)
curl https://chestnoru-production.up.railway.app/api/gamification/tiers

# Rewards config (public)
curl https://chestnoru-production.up.railway.app/api/rewards/config

# Partners list (public)
curl https://chestnoru-production.up.railway.app/api/rewards/partners

# Authenticated request (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" \
  https://chestnoru-production.up.railway.app/api/gamification/profile
```

### Cypress E2E Tests

```bash
# Run all Iteration 3 tests
npx cypress run --spec "cypress/e2e/iteration3/**/*.cy.ts"

# Run specific feature
npx cypress run --spec "cypress/e2e/iteration3/gamification.cy.ts"
npx cypress run --spec "cypress/e2e/iteration3/rewards.cy.ts"
```

---

## 8. Test Data Setup

### Required Seed Data
- 5 partner companies (already seeded via migration)
- 10+ rewards in catalog
- Sample achievements
- Test user accounts with various point balances

### Database Reset (for clean testing)
```sql
-- Reset gamification data
TRUNCATE qr_scan_history, qr_user_achievements, qr_claimed_rewards CASCADE;
UPDATE qr_scanner_profiles SET total_scans = 0, points = 0, tier = 'none';

-- Reset rewards data
TRUNCATE review_points_transactions, reward_redemptions CASCADE;
UPDATE user_review_points SET current_points = 0, lifetime_points = 0;

-- Reset moderation queue
TRUNCATE moderation_queue, moderation_actions CASCADE;
```

---

## 9. Test Environment

| Environment | URL | Purpose |
|-------------|-----|---------|
| Production | chestnoru-production.up.railway.app | Live testing |
| Local | localhost:8080 | Development |

### Environment Variables Required
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_JWT_SECRET=xxx
DATABASE_URL=postgresql://...
```

---

## 10. Sign-Off Checklist

- [ ] All GAM-* tests pass
- [ ] All REW-* tests pass
- [ ] All RET-* tests pass
- [ ] All MOD-* tests pass
- [ ] All INT-* tests pass
- [ ] Performance targets met
- [ ] No security vulnerabilities
- [ ] Documentation complete

**Tested By:** ________________
**Date:** ________________
**Approved By:** ________________
