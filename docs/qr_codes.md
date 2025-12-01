# QR Codes & Offline Marketing

## Overview

QR-коды позволяют бизнесам размещать ссылки на свои публичные страницы в офлайн-материалах (упаковка, флаеры, наклейки, постеры).

## Architecture

### URL Schema

**Публичный URL бизнеса:**
```
https://<domain>/org/{slug}?src=qr_business_main
```

**QR Redirect Endpoint (для трекинга):**
```
https://<domain>/qr/b/{slug}
```
Этот endpoint логирует событие сканирования и редиректит на публичную страницу.

### Database Schema

#### Table: `qr_scan_events`
Трекинг сканов простых QR-кодов бизнесов (без записи в `qr_codes`):

```sql
CREATE TABLE qr_scan_events (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id),
    qr_type text DEFAULT 'business_main',
    user_id uuid REFERENCES app_profiles(id),
    ip_hash text,
    user_agent text,
    created_at timestamptz DEFAULT now()
);
```

#### Table: `qr_codes` (existing)
Для продвинутых QR-кодов с индивидуальными кодами (используется для продуктов, постов и т.д.).

### Backend API

#### Get Business Public URL
```
GET /api/organizations/{organization_id}/public-url
```
Returns: `{ public_url: string, slug: string, name: string, organization_id: string }`

#### Admin Get Business Public URL
```
GET /api/organizations/{organization_id}/public-url/admin
```
Admin-only endpoint to get public URL for any business.

#### QR Redirect Endpoint
```
GET /qr/b/{slug}
```
Logs scan event and redirects to `/org/{slug}?src=qr_business_main`

### Frontend Components

#### BusinessQrCode Component
`frontend/src/components/qr/BusinessQrCode.tsx`

Features:
- Generates QR code using `qrcode.react`
- Download as PNG (standard size)
- Download as A4 poster (with branding)
- Copy URL to clipboard

#### OrganizationQrPage
`frontend/src/pages/OrganizationQr.tsx`

Business dashboard page showing:
- Main business QR code (always available)
- List of custom QR codes (from `qr_codes` table)
- Statistics for custom QR codes

#### Admin QR Section
`frontend/src/pages/AdminPanel.tsx` → `AdminBusinessQrSection`

Admin panel section showing:
- List of all businesses
- View QR code for any business
- Download QR codes

## Tracking

### How It Works

1. **QR Code Generation**: Business generates QR code encoding URL `/qr/b/{slug}`
2. **User Scans QR**: Opens `/qr/b/{slug}` in browser
3. **Backend Logs Event**: Creates entry in `qr_scan_events` table
4. **Redirect**: User redirected to `/org/{slug}?src=qr_business_main`
5. **Frontend Tracking**: Public page checks for `src=qr_business_main` parameter

### Tracking Parameters

- `src=qr_business_main` - Indicates scan came from main business QR code
- `qr_type=business_main` - Stored in `qr_scan_events` table

## Usage Guide

### For Business Owners

1. **Access QR Code**:
   - Go to Dashboard → QR Codes (`/dashboard/organization/qr`)
   - Main QR code is displayed at the top

2. **Download QR Code**:
   - Click "Скачать PNG" for standard size (800x800px)
   - Click "Скачать для печати A4" for poster format

3. **Use QR Code**:
   - Print and place on packaging, flyers, posters
   - Share digitally in marketing materials
   - QR code always links to your public business page

### For Admins

1. **View Business QR Codes**:
   - Go to Admin Panel → Business QR Codes
   - Filter by status (pending/verified/rejected)
   - Click "View QR Code" for any business

2. **Copy/Download**:
   - View QR code modal shows full QR with download options
   - Copy URL for sharing

## Statistics

### Current Implementation

- Basic scan tracking via `qr_scan_events` table
- Statistics available per organization
- Future: Analytics dashboard with charts and trends

### Query Example

```sql
SELECT COUNT(*) as total_scans
FROM qr_scan_events
WHERE organization_id = '...'
  AND qr_type = 'business_main'
  AND created_at >= NOW() - INTERVAL '30 days';
```

## Technical Details

### QR Code Generation

- **Library**: `qrcode.react` (React component)
- **Format**: SVG → Canvas → PNG for downloads
- **Error Correction**: Level M (Medium)
- **Size**: Configurable (default 256px for display, 800px for PNG download)

### Security

- IP addresses are hashed before storage
- User IDs stored only if user is logged in
- Public URLs are accessible to everyone (by design)
- Admin endpoints require `platform_admin` role

## Future Enhancements

- [ ] QR code analytics dashboard with charts
- [ ] Custom QR codes for products/posts
- [ ] QR code templates with branding
- [ ] Bulk QR code generation
- [ ] QR code expiration dates
- [ ] Geographic tracking (country/city from IP)

## Files Created/Modified

### Backend
- `backend/app/services/qr_business.py` - Business QR service
- `backend/app/api/routes/qr_business.py` - Business QR API routes
- `supabase/migrations/0021_qr_scan_events.sql` - Migration for scan events table
- Updated `backend/app/main.py` - Added QR business routes

### Frontend
- `frontend/src/components/qr/BusinessQrCode.tsx` - QR code component
- Updated `frontend/src/pages/OrganizationQr.tsx` - Added main business QR
- Updated `frontend/src/pages/AdminPanel.tsx` - Added QR section
- Updated `frontend/src/pages/PublicOrganization.tsx` - Added QR tracking
- Updated `frontend/src/api/authService.ts` - Added QR API functions

## Test Scenarios

### As Business Owner

1. Login as business owner
2. Navigate to `/dashboard/organization/qr`
3. Verify main QR code is displayed
4. Click "Скачать PNG" → Verify PNG downloads
5. Click "Скачать для печати A4" → Verify poster downloads
6. Copy URL → Verify URL is copied to clipboard

### As Admin

1. Login as admin
2. Navigate to `/admin` → "Business QR Codes" tab
3. Filter by "Verified" → Verify list shows verified businesses
4. Click "View QR Code" for a business → Verify QR code modal opens
5. Download QR code → Verify download works
6. Copy URL → Verify URL is copied

### As Regular User (Scanning QR)

1. Scan QR code (or open `/qr/b/{slug}` directly)
2. Verify redirect to `/org/{slug}?src=qr_business_main`
3. Verify public business page loads correctly
4. Check database → Verify entry created in `qr_scan_events`

## Troubleshooting

### QR Code Not Generating

- Check organization has `slug` field set
- Verify organization is `public_visible = true`
- Check browser console for errors

### Downloads Not Working

- Verify `qrcode.react` is installed: `npm list qrcode.react`
- Check browser allows downloads
- Try different browser if issues persist

### Tracking Not Working

- Verify `qr_scan_events` table exists (run migration)
- Check backend logs for errors
- Verify redirect endpoint `/qr/b/{slug}` is accessible


