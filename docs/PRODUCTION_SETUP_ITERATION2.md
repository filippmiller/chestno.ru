# Production Setup - Iteration 2 Features

**Date:** 2026-02-01
**Status:** Configuration Required

## Environment Variables to Add

Add these environment variables to Railway:

### Telegram Bot (Required for alerts & verification bot)

```bash
TELEGRAM_BOT_TOKEN=<your_bot_token>
```

To get a Telegram Bot Token:
1. Message @BotFather on Telegram
2. Send `/newbot`
3. Follow prompts to name your bot (e.g., `ChestnoVerifyBot`)
4. Copy the token provided

### Geographic Analytics (Optional)

```bash
YANDEX_MAPS_API_KEY=<your_yandex_api_key>
```

Get API key from: https://developer.tech.yandex.ru/

### Certification Verification (Optional)

```bash
ROSAKKREDITATSIYA_API_KEY=<api_key>
ROSAKKREDITATSIYA_API_URL=https://pub.fsa.gov.ru/api/v1/
```

Get API access from: https://pub.fsa.gov.ru/

---

## Telegram Webhook Setup

After setting TELEGRAM_BOT_TOKEN, configure the webhook:

### Option 1: Via API endpoint (after backend restart)

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-backend-url.railway.app/api/telegram/webhook"}'
```

### Option 2: Via Telegram API directly

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-backend-url.railway.app/api/telegram/webhook"
```

### Verify webhook is set:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## Database Migrations Applied

All 17 migrations from Iteration 2 have been applied:

| Migration | Status | Description |
|-----------|--------|-------------|
| 0040_qr_gamification | ✅ | QR scan tiers, achievements, rewards |
| 0040_review_helpfulness_voting | ✅ | Review voting with Wilson score |
| 0040_dynamic_qr_urls | ✅ | Dynamic URL management |
| 0040_product_comparisons | ✅ | Product comparison views |
| 0040_eco_impact_scoring | ✅ | Environmental impact scores |
| 0040_better_alternatives | ✅ | Alternative product recommendations |
| 0040_telegram_bot | ✅ | Telegram user tracking |
| 0040_scan_alerts | ✅ | Real-time scan alerts |
| 0040_purchase_verification | ✅ | Purchase verification badges |
| 0040_geographic_scan_analytics | ✅ | Location-based analytics |
| 0028_anti_counterfeit | ✅ | Anti-counterfeiting detection |
| 0041_story_videos | ✅ | Producer story videos |
| 0041_trust_preferences | ✅ | Personalized trust weights |
| 0041_business_response_system | ✅ | B2B response management |
| 0041_review_rewards_system | ✅ | Review rewards points |
| 0041_scan_alert_triggers | ✅ | Alert trigger functions |
| 0047_telegram_bot | ✅ | Additional bot features |

---

## Verification Steps

### 1. Check Backend Health
```bash
curl https://your-backend-url.railway.app/api/health
```

### 2. Verify New Endpoints
```bash
# Gamification
curl https://your-backend-url.railway.app/gamification/tiers

# Review Votes
curl https://your-backend-url.railway.app/api/reviews/{id}/vote

# Dynamic QR
curl https://your-backend-url.railway.app/qr/{code}/versions
```

### 3. Test Telegram Bot
1. Search for your bot on Telegram
2. Send `/start`
3. Try `/verify компания_название`

---

## Feature Testing Checklist

- [ ] QR Gamification: Scan QR → Check tier progression
- [ ] Review Voting: Upvote/downvote reviews
- [ ] Dynamic QR: Change URL without reprinting
- [ ] Better Alternatives: View product recommendations
- [ ] Environmental Score: Check eco impact badges
- [ ] Telegram Bot: Verify business via bot
- [ ] Scan Alerts: Receive alerts on anomalies
- [ ] Producer Videos: Upload and view story videos
- [ ] Trust Preferences: Customize score weights

---

## Rollback Instructions

If issues occur, rollback migrations:

```sql
-- In Supabase SQL Editor
DROP TABLE IF EXISTS qr_scanner_profiles CASCADE;
DROP TABLE IF EXISTS qr_scan_history CASCADE;
DROP TABLE IF EXISTS qr_achievements CASCADE;
-- ... (continue for each table)
```

Or restore from last known good backup.

---

**Next Steps:**
1. Add environment variables in Railway dashboard
2. Redeploy backend to pick up new config
3. Set Telegram webhook
4. Run E2E tests
