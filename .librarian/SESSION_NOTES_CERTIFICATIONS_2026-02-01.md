# Session Notes: Certification & Compliance Hub

**Date:** 2026-02-01
**Feature:** Certification Management System
**Status:** Design Complete, Ready for Implementation

---

## Overview

Designed and implemented a comprehensive Certification & Compliance Hub for chestno.ru that allows producers to manage their certifications (GOST, organic, halal, kosher, eco-labels) and enables consumers to verify certification authenticity.

---

## 5 Concrete Features Implemented

### 1. Certification Registry & Database Schema
**Location:** `supabase/migrations/0035_certifications_hub.sql`

- **certification_types** - Reference table with 23 pre-seeded Russian and international certifications
- **producer_certifications** - Producer certification records with full lifecycle tracking
- **product_certifications** - Links certifications to specific products
- Categories: quality_standard, organic, religious, eco_label, safety, origin

**Pre-seeded certifications include:**
- Quality: GOST R, GOST ISO, ISO 9001, ISO 22000, Roskachestvo
- Organic: Organic RU, EU Organic, USDA Organic, Ecocert
- Religious: Halal (RU/ISWA), Kosher (RU/OU)
- Eco: Leaf of Life, FSC, Rainforest Alliance
- Safety: Sanitary, Declaration of Conformity, Fire Safety
- Origin: PDO (NMPT), PGI (GU)

### 2. Document Management System
**Locations:**
- `backend/app/services/certifications.py` (upload_document, verify_document_ocr)
- `backend/app/api/certifications.py` (upload endpoint)

Features:
- Document upload to Supabase Storage (PDF, PNG, JPG)
- 10MB size limit with content type validation
- Original filename preservation
- Placeholder for OCR verification (Google Document AI / AWS Textract integration point)
- Document history tracking

### 3. Multi-Level Verification System
**Location:** `backend/app/services/certifications.py`

Verification statuses:
- `pending` - Awaiting review
- `verified` - Confirmed by chestno.ru staff
- `auto_verified` - Verified via external API
- `rejected` - Failed verification
- `expired` - Past expiry date
- `revoked` - Revoked by issuing body

Features:
- Manual verification by platform admins
- External API verification stubs for:
  - Rosstandart (GOST certificates)
  - Roskachestvo (quality marks)
  - Rosaccreditation (declarations)
- Full verification audit log
- Admin verification queue

### 4. Expiry Tracking & Alerting System
**Locations:**
- `supabase/migrations/0035_certifications_hub.sql` (tables, functions)
- `backend/app/cron/certification_expiry.py` (cron job)

Features:
- Automatic alert scheduling at 90, 60, 30, 14, 7, 1 days before expiry
- Daily cron job for expiry status updates
- Email + push notification integration
- Alert acknowledgement tracking
- Urgency levels (high/medium/low) based on days remaining

Database functions:
- `check_certification_expiry()` - Updates expired cert statuses
- `schedule_expiry_alerts()` - Creates alert records
- `get_org_certifications()` - Efficient cert retrieval

### 5. Consumer Verification Portal
**Location:** `backend/app/api/certifications.py` (public endpoints)

Public endpoints (no auth required):
- `GET /certifications/public/organizations/{org_id}` - View org's verified certs
- `GET /certifications/public/products/{product_id}` - View product's certs
- `POST /certifications/public/search` - Search products by certification type
- `POST /certifications/public/verify-request` - Submit verification request

Consumer features:
- View verified certification badges on product pages
- Filter/search products by certification type
- Request authenticity verification
- Report disputed certifications

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/0035_certifications_hub.sql` | Database schema + seed data |
| `backend/app/schemas/certifications.py` | Pydantic models (backend) |
| `frontend/src/types/certifications.ts` | TypeScript types (frontend) |
| `backend/app/services/certifications.py` | Business logic service |
| `backend/app/api/certifications.py` | FastAPI routes |
| `backend/app/cron/certification_expiry.py` | Scheduled expiry checks |

---

## API Endpoints Summary

### Producer Management (Auth Required)
```
POST   /certifications/organizations/{org_id}          Create certification
GET    /certifications/organizations/{org_id}          List org certifications
GET    /certifications/organizations/{org_id}/summary  Get summary stats
GET    /certifications/{cert_id}                       Get certification
PATCH  /certifications/{cert_id}                       Update certification
DELETE /certifications/{cert_id}                       Delete certification
POST   /certifications/{cert_id}/document              Upload document
GET    /certifications/{cert_id}/verification-log      Get verification history
```

### Expiry Alerts (Auth Required)
```
GET    /certifications/organizations/{org_id}/expiry-alerts  Get pending alerts
POST   /certifications/expiry-alerts/{alert_id}/acknowledge  Acknowledge alert
```

### Public Consumer Portal
```
GET    /certifications/types                           List cert types
GET    /certifications/public/organizations/{org_id}   Public org certs
GET    /certifications/public/products/{product_id}    Product certs
POST   /certifications/public/search                   Search by cert
POST   /certifications/public/verify-request           Request verification
```

### Admin Queue
```
GET    /certifications/admin/stats                     Dashboard stats
GET    /certifications/admin/pending                   Pending queue
POST   /certifications/admin/verify                    Verify/reject/revoke
GET    /certifications/expiring-soon                   Expiring certs
POST   /certifications/admin/run-expiry-check          Manual expiry check
```

---

## Business Value

1. **Premium Feature for Producers**
   - Verified certification badges increase consumer trust
   - Expiry reminders prevent compliance lapses
   - Document storage ensures audit readiness

2. **Consumer Trust**
   - Verified badges confirm authenticity
   - Public verification portal enables fact-checking
   - Dispute mechanism for suspected fraud

3. **Platform Differentiation**
   - Unique feature vs competitors
   - Integration with Russian certification bodies
   - Comprehensive compliance management

4. **Revenue Opportunities**
   - Premium tier: unlimited certifications
   - Enterprise: automated verification API access
   - Verification as a service for other platforms

---

## Integration Points Identified

### External APIs (Future Implementation)
- **Rosstandart** - GOST certificate verification
- **Roskachestvo** - Quality mark verification
- **Rosaccreditation (FSA)** - Declaration verification
- **Rospatent** - Geographic origin verification

### Internal Integrations
- Notification service (email/push for expiry alerts)
- Product pages (certification badges)
- Organization profiles (certification section)
- Search/filter (by certification type)

---

## Next Steps

1. **Frontend Components**
   - CertificationBadge component
   - CertificationUploadForm
   - ExpiryAlertsList
   - CertificationSearchFilter

2. **External API Integration**
   - Research Rosstandart API access
   - Implement Roskachestvo integration
   - Add FSA declaration lookup

3. **Admin Dashboard**
   - Verification queue UI
   - Bulk verification tools
   - Analytics dashboard

4. **Testing**
   - Unit tests for service layer
   - API endpoint tests
   - Expiry cron job tests

---

## Database Migration Notes

Migration `0035_certifications_hub.sql` includes:
- 6 new tables
- 23 pre-seeded certification types
- 3 database functions
- Complete RLS policies
- Appropriate indexes for common queries

To run migration:
```bash
supabase db push
```

---

## Knowledge Captured

- Russian certification landscape mapped (GOST, organic, religious, eco)
- Verification workflow designed (pending → verified/rejected → expired)
- Alert timing best practices (90/60/30/14/7/1 days)
- Consumer verification UX patterns established
