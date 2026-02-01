# QR Code Gamification System - Feature Specification

**Date:** 2026-02-01
**Feature:** QR Code Scanning Gamification
**Status:** Implementation Ready

## Overview

A gamification system designed to increase QR code scan engagement through a 3-tier progression system, achievements, rewards, and monthly leaderboards. This system is **separate** from the existing review-based loyalty points system.

## System Architecture

### Database Schema

**New Tables Created:**
1. `qr_scanner_profiles` - User scanning statistics and tier tracking
2. `qr_scan_history` - Detailed log of each scan
3. `qr_achievements` - Achievement definitions
4. `user_qr_achievements` - User-earned achievements
5. `qr_rewards` - Available rewards
6. `user_claimed_rewards` - Claimed reward records
7. `qr_monthly_leaderboards` - Archived monthly rankings
8. `partner_discount_codes` - Partner discount code pool

**New Types:**
- `qr_scan_tier` ENUM: 'none', 'bronze', 'silver', 'gold'

**Key Functions:**
- `calculate_qr_scan_tier(scans)` - Determines tier from scan count
- `record_qr_scan(...)` - Records scan and returns tier/achievement updates
- `archive_monthly_leaderboard(year, month)` - Archives monthly rankings

### Tier System

| Tier | Threshold | Color | Benefits |
|------|-----------|-------|----------|
| None | 0 | #6B7280 | Basic scanning |
| Bronze | 5 scans | #CD7F32 | Certificate, basic rewards, +10% points |
| Silver | 20 scans | #C0C0C0 | Beta access, +25% points, partner discounts |
| Gold | 50 scans | #FFD700 | VIP access, +50% points, premium discounts, prizes |

### Achievements

**Tier Achievements:**
- `tier_bronze` - 5 scans (+50 points)
- `tier_silver` - 20 scans (+150 points)
- `tier_gold` - 50 scans (+500 points)

**Explorer Achievements:**
- `org_explorer_5` - 5 different companies (+30 points)
- `org_explorer_20` - 20 different companies (+100 points)
- `org_explorer_50` - 50 different companies (+300 points)

**Streak Achievements:**
- `streak_3` - 3 consecutive days (+20 points)
- `streak_7` - 7 consecutive days (+75 points)
- `streak_30` - 30 consecutive days (+500 points)

**Special Achievements:**
- `first_scan` - First QR scan (+10 points)
- `night_owl` - Scan after midnight (+15 points)
- `early_bird` - Scan before 7 AM (+15 points)
- `weekend_scanner` - 10 weekend scans (+30 points)

### Rewards

**Tier-Based (Free):**
- Bronze/Silver/Gold Certificates (PDF download)

**Points-Based:**
- Early Access to Beta Features (100 points, Silver+)
- Premium Week (200 points, Bronze+)

**Partner Rewards:**
- Discount codes from partner organizations

## API Endpoints

### Profile & Dashboard
- `GET /api/v1/gamification/profile` - User's scanner profile
- `GET /api/v1/gamification/dashboard` - Complete dashboard data

### Scanning
- `POST /api/v1/gamification/scan` - Record a scan
- `GET /api/v1/gamification/history` - Scan history

### Achievements
- `GET /api/v1/gamification/achievements` - All achievements with progress
- `POST /api/v1/gamification/achievements/mark-seen` - Mark as seen

### Rewards
- `GET /api/v1/gamification/rewards` - Available and claimed rewards
- `POST /api/v1/gamification/rewards/claim` - Claim a reward

### Leaderboard
- `GET /api/v1/gamification/leaderboard?period=monthly` - Current leaderboard
- `GET /api/v1/gamification/leaderboard/monthly/{year}/{month}` - Archived

### Info
- `GET /api/v1/gamification/tiers` - Tier requirements and benefits

## React Components

### Core Components
- `ScanTierBadge` - Visual tier badge with tooltip
- `TierProgressCard` - Main tier display with progress bar
- `AchievementBadge` - Single achievement with rarity
- `AchievementsGrid` - Categorized achievement display
- `ScanLeaderboard` - Monthly/all-time rankings
- `RewardsSection` - Available and claimed rewards
- `ScanResultModal` - Animated post-scan feedback
- `GamificationDashboard` - Main dashboard component

### Usage Example
```tsx
import { GamificationDashboard, ScanResultModal } from '@/components/gamification'

// In a page component
<GamificationDashboard userId={userId} />

// After a scan
<ScanResultModal
  result={scanResult}
  isOpen={showModal}
  onClose={() => setShowModal(false)}
/>
```

## Files Created

### Database
- `supabase/migrations/0040_qr_gamification.sql`

### Frontend
- `frontend/src/types/qr-gamification.ts`
- `frontend/src/components/gamification/ScanTierBadge.tsx`
- `frontend/src/components/gamification/TierProgressCard.tsx`
- `frontend/src/components/gamification/AchievementBadge.tsx`
- `frontend/src/components/gamification/AchievementsGrid.tsx`
- `frontend/src/components/gamification/ScanLeaderboard.tsx`
- `frontend/src/components/gamification/RewardsSection.tsx`
- `frontend/src/components/gamification/ScanResultModal.tsx`
- `frontend/src/components/gamification/GamificationDashboard.tsx`
- `frontend/src/components/gamification/index.ts`

### Backend
- `backend/app/services/gamification.py`
- `backend/app/api/routes/gamification.py`

## Integration Points

### Existing QR Scan Flow
When a QR code is scanned, call the gamification API:
```typescript
const result = await httpClient.post('/api/v1/gamification/scan', {
  organization_id: qrData.organizationId,
  product_id: qrData.productId,
  qr_code_id: qrData.qrCodeId,
  scan_type: 'product',
})

// Show result modal
if (result.tier_changed || result.new_achievements.length > 0) {
  showScanResultModal(result)
}
```

### Profile Integration
Add tier badge to user profiles:
```tsx
<ScanTierBadge tier={user.scanTier} size="md" />
```

### Partner Integration
1. Partners upload discount codes via admin panel
2. Codes are assigned to users when claiming discount rewards
3. Partners can track redemption via their dashboard

## Future Enhancements

1. **Category-based achievements** - Scan X products in specific categories
2. **Location achievements** - Scan in different cities/regions
3. **Referral bonuses** - Points for inviting friends
4. **Seasonal events** - Time-limited achievements and rewards
5. **Physical prizes** - Monthly prize draws for top scanners
6. **Social features** - Share achievements, challenge friends

## Maintenance Tasks

### Monthly Cron Job
Archive monthly leaderboard at end of each month:
```sql
SELECT archive_monthly_leaderboard(2026, 1);
```

### Reset Monthly Counters
The `scans_this_month` counter auto-resets on first scan of new month.

## Security Considerations

- RLS policies restrict users to their own data
- Service role required for administrative operations
- Rate limiting recommended on scan endpoint (prevent abuse)
- Reward claiming validates tier eligibility server-side
