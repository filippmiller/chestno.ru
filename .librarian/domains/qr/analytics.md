# QR Code System

> Last updated: 2026-01-18
> Domain: qr
> Keywords: qr, code, scan, analytics, tracking, utm, geo, geolocation, redirect

## Overview

Trackable QR codes that redirect to organization pages while logging
scan events with geographic and UTM data for analytics.

---

## How It Works

```
1. Organization creates QR code with label
2. System generates unique code (e.g., "abc123")
3. QR code URL: https://chestno.ru/q/abc123
4. User scans QR code
5. Request hits /q/{code} endpoint
6. Backend logs event with:
   - Hashed IP (privacy)
   - User agent
   - Referer
   - UTM parameters (from query string)
   - Geographic location (GeoIP)
7. Returns 302 redirect to organization page
8. Organization views analytics in dashboard
```

---

## Database Tables

### qr_codes
**Purpose:** QR code definitions
**File:** `supabase/migrations/0006_qr_codes.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| organization_id | uuid | Owner organization |
| code | text | Unique identifier in URL |
| label | text | Human-readable name |
| target_type | text | 'organization', 'product', 'post' |
| target_slug | text | Target entity slug |
| is_active | boolean | Can be deactivated |
| created_by | uuid | User who created |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### qr_events
**Purpose:** Scan event logs
**File:** `supabase/migrations/0006_qr_codes.sql`, `0021_qr_enhancements.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | Primary key |
| qr_code_id | uuid | References qr_codes |
| occurred_at | timestamptz | Scan timestamp |
| ip_hash | text | SHA256(IP + salt) for privacy |
| user_agent | text | Browser/device info |
| referer | text | Referring page |
| country | text | From GeoIP |
| city | text | From GeoIP |
| utm_source | text | UTM parameter |
| utm_medium | text | UTM parameter |
| utm_campaign | text | UTM parameter |
| raw_query | text | Full query string |

---

## Backend Service

### qr.py
**File:** `backend/app/services/qr.py`

**Functions:**
```python
create_qr_code(org_id, user_id, payload)
# Create new QR code, checks quota

list_qr_codes(org_id, user_id)
# List all QR codes for organization

get_qr_stats(org_id, qr_id, user_id)
# Returns: { total, last_7_days, last_30_days }

get_qr_detailed_stats(org_id, qr_id, user_id)
# Returns: { ...stats, geo_breakdown, utm_breakdown }

log_event_and_get_redirect(code, client_ip, user_agent, referer, raw_query)
# Main redirect handler:
# 1. Hash IP with salt
# 2. Parse UTM params
# 3. GeoIP lookup
# 4. Insert qr_events record
# 5. Return redirect URL
```

---

## API Endpoints

### Management (Authenticated)
| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| POST | `/api/organizations/{org_id}/qr-codes` | Create QR | Manager+ |
| GET | `/api/organizations/{org_id}/qr-codes` | List QR codes | Member |
| GET | `/api/organizations/{org_id}/qr-codes/{qr_id}/stats` | Basic stats | Analyst+ |
| GET | `/api/organizations/{org_id}/qr-codes/{qr_id}/detailed-stats` | Full analytics | Analyst+ |

### Public Redirect
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/q/{code}` | Log scan and redirect |

---

## Analytics Data

### Basic Stats
```json
{
  "total": 1234,
  "last_7_days": 89,
  "last_30_days": 342
}
```

### Detailed Stats
```json
{
  "total": 1234,
  "last_7_days": 89,
  "last_30_days": 342,
  "geo_breakdown": [
    { "country": "Russia", "city": "Moscow", "count": 500 },
    { "country": "Russia", "city": "Saint Petersburg", "count": 200 }
  ],
  "utm_breakdown": [
    { "utm_source": "instagram", "utm_medium": "social", "utm_campaign": "summer2024", "count": 150 },
    { "utm_source": "telegram", "utm_medium": "messenger", "utm_campaign": null, "count": 100 }
  ]
}
```

---

## Frontend Pages

### OrganizationQr.tsx
**Route:** `/dashboard/organization/qr`
**Purpose:** QR code management
**Features:**
- Create new QR codes
- View list of QR codes
- See scan statistics
- View detailed geo/UTM breakdown

### OrganizationAnalytics.tsx
**Route:** `/dashboard/organization/analytics`
**Purpose:** Comprehensive analytics dashboard
**Features:**
- Timeline charts
- Geographic breakdown with map
- UTM parameter analysis
- Export as CSV/JSON

### QRGeoMap.tsx
**Component:** `frontend/src/components/qr/QRGeoMap.tsx`
**Purpose:** Map visualization of scan locations

---

## UTM Parameters

Supported UTM parameters extracted from QR URL:
- `utm_source` - Traffic source (e.g., instagram, telegram)
- `utm_medium` - Marketing medium (e.g., social, email)
- `utm_campaign` - Campaign name

**Example URL:**
```
https://chestno.ru/q/abc123?utm_source=instagram&utm_medium=social&utm_campaign=summer2024
```

---

## Privacy Considerations

1. **IP Hashing** - IPs are hashed with a salt before storage
   - Salt configured in `QR_IP_HASH_SALT` env var
   - Original IP never stored

2. **GeoIP** - Only country/city stored, not precise location
   - Uses MaxMind GeoLite2 database
   - Database path: `GEOIP_DB_PATH` env var

3. **No Personal Data** - No user identification beyond device fingerprint

---

## Subscription Limits

QR code creation respects subscription limits:
- Free: 3 QR codes
- Standard: 25 QR codes
- Pro: Unlimited

**Check function:** `backend/app/services/subscriptions.py` → `check_org_limit(org_id, 'qr_codes')`

---

## Marketing Integration

QR codes can be embedded in marketing materials:
- `OrganizationQrPoster.tsx` - Design posters with QR
- Marketing templates include QR block type
- QR code image generated client-side or via API
