# Session 17: Retail and In-Store Experience Features

## Executive Summary

This document specifies 5 concrete retail features that extend chestno.ru's trust verification system into physical retail environments. These features leverage existing QR infrastructure, loyalty system, and status badges to create seamless in-store experiences for retailers, staff, and consumers.

---

## Feature 1: Retail Store Registry and Analytics

### Purpose
Enable retailers to register their physical store locations and track which stores drive the most product verification scans. This provides manufacturers with valuable insight into where their verified products perform best.

### Database Schema

```sql
-- Migration: 0035_retail_stores.sql

-- Retail store registry
CREATE TABLE IF NOT EXISTS retail_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Store identification
    store_code TEXT NOT NULL UNIQUE,  -- Human-readable code like "METRO-MSK-001"
    name TEXT NOT NULL,
    chain_name TEXT,  -- "Metro", "Perekrestok", etc.

    -- Location
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    region TEXT,
    postal_code TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Contact
    manager_name TEXT,
    manager_email TEXT,
    manager_phone TEXT,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    verified_at TIMESTAMPTZ,  -- When chestno verified this store

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_retail_stores_chain ON retail_stores(chain_name);
CREATE INDEX idx_retail_stores_city ON retail_stores(city);
CREATE INDEX idx_retail_stores_active ON retail_stores(is_active);

-- Link products to stores they're sold in
CREATE TABLE IF NOT EXISTS store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES retail_stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Shelf location
    aisle TEXT,
    shelf_position TEXT,

    -- Pricing (store-specific)
    store_price_cents INTEGER,

    -- Status
    in_stock BOOLEAN NOT NULL DEFAULT true,
    last_stock_check TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_store_product UNIQUE (store_id, product_id)
);

-- Store scan events (extends existing qr_scan_events)
CREATE TABLE IF NOT EXISTS store_scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to existing systems
    qr_scan_event_id UUID REFERENCES qr_scan_events(id),
    store_id UUID REFERENCES retail_stores(id),
    product_id UUID REFERENCES products(id),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Scan context
    scan_source TEXT NOT NULL DEFAULT 'shelf' CHECK (scan_source IN (
        'shelf',           -- Scanned from shelf display
        'kiosk',           -- From store kiosk
        'checkout',        -- At POS/checkout
        'staff_device',    -- Staff scanner
        'signage'          -- Digital signage
    )),

    -- Attribution
    store_staff_id UUID REFERENCES app_users(id),

    -- Timestamps
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_scans_store ON store_scan_events(store_id);
CREATE INDEX idx_store_scans_product ON store_scan_events(product_id);
CREATE INDEX idx_store_scans_source ON store_scan_events(scan_source);
CREATE INDEX idx_store_scans_time ON store_scan_events(scanned_at);
```

### API Endpoints

```
GET    /api/retail/stores                    -- List stores (with filtering)
POST   /api/retail/stores                    -- Register new store
GET    /api/retail/stores/{store_id}         -- Get store details
PUT    /api/retail/stores/{store_id}         -- Update store
DELETE /api/retail/stores/{store_id}         -- Deactivate store

GET    /api/retail/stores/{store_id}/products        -- Products in store
POST   /api/retail/stores/{store_id}/products        -- Add product to store
PUT    /api/retail/stores/{store_id}/products/{id}   -- Update store product
DELETE /api/retail/stores/{store_id}/products/{id}   -- Remove from store

GET    /api/retail/analytics/stores                  -- Store performance ranking
GET    /api/retail/analytics/stores/{store_id}       -- Individual store stats
GET    /api/organizations/{org_id}/retail-analytics  -- Org's products in stores
```

### Frontend Components

```typescript
// RetailStoreMap.tsx - Interactive map showing store locations and scan density
// StoreAnalyticsDashboard.tsx - Store-level performance metrics
// StoreRegistrationForm.tsx - Onboarding form for new retail partners
```

### Business Value
- Manufacturers understand which retail partners drive consumer engagement
- Retailers demonstrate value to suppliers through verification metrics
- Enables store-specific promotions and inventory optimization

---

## Feature 2: Interactive Scanner Kiosk Mode

### Purpose
Provide a dedicated kiosk interface for in-store tablets/displays where customers can scan products and view detailed trust information without needing the mobile app.

### Technical Implementation

```typescript
// KioskMode.tsx - Full-screen kiosk interface

interface KioskConfig {
    storeId: string;
    storeName: string;
    brandingColor?: string;
    logoUrl?: string;
    idleVideoUrl?: string;
    language: 'ru' | 'en';
    features: {
        priceComparison: boolean;
        reviews: boolean;
        loyaltySignup: boolean;
        printReceipt: boolean;
    };
}

interface KioskScanResult {
    product: {
        name: string;
        brand: string;
        statusLevel: 'A' | 'B' | 'C';
        trustScore: number;
        verificationDate: string;
        certifications: string[];
        origin: string;
        ingredients?: string[];
    };
    priceComparison?: {
        currentPrice: number;
        averagePrice: number;
        lowestPrice: number;
        priceHistory: Array<{date: string; price: number}>;
    };
    reviews?: {
        averageRating: number;
        totalReviews: number;
        recentReviews: Array<{text: string; rating: number; date: string}>;
    };
}
```

### Kiosk UI Flow

1. **Idle State**: Branded screensaver with "Scan any product" call-to-action
2. **Scanning**: Camera active with scan frame overlay
3. **Loading**: Trust badge animation while fetching data
4. **Result**: Full product trust information display
5. **Actions**: Print summary, add to shopping list, leave review
6. **Return**: Auto-reset to idle after 30 seconds

### Database Schema

```sql
-- Kiosk devices registry
CREATE TABLE IF NOT EXISTS retail_kiosks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES retail_stores(id) ON DELETE CASCADE,

    -- Device info
    device_code TEXT NOT NULL UNIQUE,
    device_name TEXT,
    location_in_store TEXT,  -- "Entrance", "Dairy Aisle", etc.

    -- Configuration
    config JSONB NOT NULL DEFAULT '{}',

    -- Health
    last_heartbeat TIMESTAMPTZ,
    is_online BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kiosk session tracking
CREATE TABLE IF NOT EXISTS kiosk_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id UUID NOT NULL REFERENCES retail_kiosks(id) ON DELETE CASCADE,

    -- Session data
    session_token TEXT NOT NULL UNIQUE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,

    -- Metrics
    products_scanned INTEGER NOT NULL DEFAULT 0,
    reviews_submitted INTEGER NOT NULL DEFAULT 0,
    loyalty_signups INTEGER NOT NULL DEFAULT 0
);
```

### API Endpoints

```
POST   /api/kiosk/authenticate               -- Kiosk device authentication
GET    /api/kiosk/config                     -- Get kiosk configuration
POST   /api/kiosk/scan                       -- Process product scan
POST   /api/kiosk/heartbeat                  -- Device health ping
GET    /api/kiosk/product/{barcode}          -- Lookup by barcode/QR
POST   /api/kiosk/print                      -- Generate printable summary
```

### Business Value
- Removes barrier of app download for in-store verification
- Provides rich product data at point of decision
- Captures valuable in-store engagement metrics

---

## Feature 3: Shelf Talker and Signage Generator

### Purpose
Generate printable shelf talkers, hang tags, and digital signage content that display product trust badges and QR codes for easy consumer scanning.

### Technical Implementation

```typescript
// ShelfTalkerGenerator.tsx

interface ShelfTalkerConfig {
    type: 'shelf_talker' | 'hang_tag' | 'sticker' | 'poster' | 'digital_sign';
    size: {
        width: number;   // mm
        height: number;  // mm
        dpi: number;     // 150 for digital, 300 for print
    };
    content: {
        productName: string;
        statusLevel: 'A' | 'B' | 'C';
        qrCodeUrl: string;
        tagline?: string;
        certifications?: string[];
        showPrice?: boolean;
        price?: number;
    };
    branding: {
        brandLogo?: string;
        accentColor?: string;
        includeChestnoLogo: boolean;
    };
    language: 'ru' | 'en';
}

// Preset sizes for common retail formats
const SHELF_TALKER_PRESETS = {
    small: { width: 52, height: 74, dpi: 300 },      // Standard price tag
    medium: { width: 70, height: 100, dpi: 300 },   // Shelf wobblers
    large: { width: 100, height: 150, dpi: 300 },   // A6 talker
    a4_poster: { width: 210, height: 297, dpi: 300 },
    digital_hd: { width: 1920, height: 1080, dpi: 72 },
    digital_4k: { width: 3840, height: 2160, dpi: 72 },
};
```

### Backend Service

```python
# shelf_talker_service.py

from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

class ShelfTalkerGenerator:
    """Generates printable shelf talkers with trust badges."""

    def generate(self, config: ShelfTalkerConfig) -> bytes:
        """Generate shelf talker image as PNG or PDF."""
        pass

    def generate_batch(self, products: list, template: str) -> bytes:
        """Generate multiple shelf talkers as print-ready PDF."""
        pass

    def generate_digital_signage(self, products: list, duration: int) -> bytes:
        """Generate rotating digital signage content."""
        pass
```

### API Endpoints

```
POST   /api/marketing/shelf-talker/generate      -- Generate single shelf talker
POST   /api/marketing/shelf-talker/batch         -- Batch generate for multiple products
GET    /api/marketing/shelf-talker/templates     -- Available templates
POST   /api/marketing/digital-signage/generate   -- Generate digital signage content
```

### Template Designs

1. **Minimal**: Status badge + QR only
2. **Informative**: Badge + "Verified by Chestno" + QR + scan CTA
3. **Premium**: Full product info + certifications + reviews summary
4. **Promotional**: Limited-time offers with trust verification

### Business Value
- Low-cost way to highlight verified products in-store
- Drives consumer engagement at shelf level
- Creates visual differentiation for participating brands

---

## Feature 4: Staff Training and Certification Portal

### Purpose
Provide retail staff with training materials and certification to become "Trust Ambassadors" who can explain product verification to customers.

### Database Schema

```sql
-- Staff training system
CREATE TABLE IF NOT EXISTS staff_training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Module info
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 15,

    -- Content
    content_type TEXT NOT NULL CHECK (content_type IN ('video', 'interactive', 'quiz')),
    content_url TEXT,
    content_data JSONB,

    -- Requirements
    prerequisite_module_id UUID REFERENCES staff_training_modules(id),
    passing_score INTEGER NOT NULL DEFAULT 80,  -- Percentage

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Staff profiles (links to app_users)
CREATE TABLE IF NOT EXISTS retail_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES retail_stores(id) ON DELETE CASCADE,

    -- Staff info
    employee_id TEXT,  -- Store's internal ID
    department TEXT,
    position TEXT,

    -- Certification
    is_certified BOOLEAN NOT NULL DEFAULT false,
    certified_at TIMESTAMPTZ,
    certification_expires_at TIMESTAMPTZ,

    -- Engagement metrics
    customer_assists INTEGER NOT NULL DEFAULT 0,
    scans_assisted INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_staff_store UNIQUE (user_id, store_id)
);

-- Training progress
CREATE TABLE IF NOT EXISTS staff_training_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES retail_staff(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES staff_training_modules(id) ON DELETE CASCADE,

    -- Progress
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
        'not_started', 'in_progress', 'completed', 'failed'
    )),
    progress_percent INTEGER NOT NULL DEFAULT 0,

    -- Quiz results
    quiz_attempts INTEGER NOT NULL DEFAULT 0,
    best_score INTEGER,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    CONSTRAINT unique_staff_module UNIQUE (staff_id, module_id)
);

-- Staff-assisted scans (for attribution)
CREATE TABLE IF NOT EXISTS staff_assisted_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES retail_staff(id) ON DELETE CASCADE,
    scan_event_id UUID NOT NULL REFERENCES store_scan_events(id) ON DELETE CASCADE,

    -- Context
    assistance_type TEXT CHECK (assistance_type IN (
        'helped_scan',      -- Physically helped customer scan
        'explained_badge',  -- Explained trust badge meaning
        'answered_question' -- Answered product question
    )),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Training Module Content

1. **Introduction to Chestno** (10 min)
   - What is product verification?
   - Status levels A, B, C explained
   - Why customers care

2. **Reading Trust Badges** (15 min)
   - Badge components
   - Verification dates
   - Certifications and what they mean

3. **Helping Customers** (15 min)
   - Common customer questions
   - How to demonstrate scanning
   - Handling skeptical customers

4. **Quiz and Certification** (10 min)
   - 20 questions, 80% to pass
   - Certificate valid for 1 year

### API Endpoints

```
GET    /api/staff/training/modules           -- List training modules
GET    /api/staff/training/modules/{id}      -- Get module content
POST   /api/staff/training/progress          -- Update progress
POST   /api/staff/training/quiz/submit       -- Submit quiz answers
GET    /api/staff/certification              -- Get certification status
POST   /api/staff/assisted-scan              -- Log assisted scan
GET    /api/retail/stores/{id}/staff         -- Store staff list
GET    /api/retail/stores/{id}/staff/leaderboard  -- Staff engagement ranking
```

### Frontend Components

```typescript
// StaffTrainingPortal.tsx - Training module viewer
// CertificationBadge.tsx - Displayable certification
// StaffLeaderboard.tsx - Gamified staff engagement
// QuickScanAssist.tsx - Mobile tool for staff to help customers
```

### Business Value
- Creates informed advocates for verified products
- Improves customer experience and trust
- Gamification drives staff engagement
- Provides retailers with training metrics

---

## Feature 5: POS Integration and Digital Receipts

### Purpose
Integrate with point-of-sale systems to display trust badges on receipts and enable post-purchase verification and review collection.

### Technical Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  POS System │────▶│ Chestno POS API  │────▶│  Database   │
└─────────────┘     └──────────────────┘     └─────────────┘
       │                     │
       │                     ▼
       │            ┌──────────────────┐
       │            │ Receipt Generator│
       │            └──────────────────┘
       │                     │
       ▼                     ▼
┌─────────────┐     ┌──────────────────┐
│   Printer   │     │  Digital Receipt │
└─────────────┘     │   (SMS/Email)    │
                    └──────────────────┘
```

### Database Schema

```sql
-- POS integration registry
CREATE TABLE IF NOT EXISTS pos_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES retail_stores(id) ON DELETE CASCADE,

    -- Integration details
    pos_provider TEXT NOT NULL,  -- "1c", "atol", "evotor", "custom"
    api_key TEXT,
    webhook_url TEXT,

    -- Configuration
    config JSONB NOT NULL DEFAULT '{}',

    -- Features enabled
    print_badges BOOLEAN NOT NULL DEFAULT true,
    digital_receipts BOOLEAN NOT NULL DEFAULT false,
    review_prompt BOOLEAN NOT NULL DEFAULT true,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase transactions (for receipt generation)
CREATE TABLE IF NOT EXISTS purchase_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES retail_stores(id) ON DELETE CASCADE,

    -- Transaction details
    external_transaction_id TEXT,  -- POS system's ID

    -- Customer (optional)
    customer_phone TEXT,
    customer_email TEXT,
    customer_user_id UUID REFERENCES app_users(id),

    -- Loyalty
    loyalty_points_earned INTEGER NOT NULL DEFAULT 0,

    -- Status
    receipt_sent BOOLEAN NOT NULL DEFAULT false,
    review_requested BOOLEAN NOT NULL DEFAULT false,

    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Line items with verification status
CREATE TABLE IF NOT EXISTS purchase_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,

    -- Product reference
    product_id UUID REFERENCES products(id),
    barcode TEXT,
    product_name TEXT NOT NULL,

    -- Verification status at time of purchase
    status_level TEXT CHECK (status_level IN ('A', 'B', 'C')),
    is_verified BOOLEAN NOT NULL DEFAULT false,

    -- Purchase details
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Digital receipt tokens
CREATE TABLE IF NOT EXISTS receipt_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,

    -- Token for secure access
    token TEXT NOT NULL UNIQUE,

    -- Delivery
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('sms', 'email', 'qr')),
    delivered_at TIMESTAMPTZ,

    -- Access tracking
    first_viewed_at TIMESTAMPTZ,
    view_count INTEGER NOT NULL DEFAULT 0,

    -- Expiry
    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Receipt Content Structure

```typescript
interface DigitalReceipt {
    transaction: {
        id: string;
        date: string;
        storeName: string;
        storeAddress: string;
    };
    items: Array<{
        name: string;
        quantity: number;
        price: number;
        verified: boolean;
        statusLevel?: 'A' | 'B' | 'C';
        productUrl?: string;
    }>;
    summary: {
        totalItems: number;
        verifiedItems: number;
        verificationPercent: number;
        totalAmount: number;
    };
    loyalty?: {
        pointsEarned: number;
        totalPoints: number;
        tier: string;
    };
    actions: {
        reviewUrl: string;
        viewAllProductsUrl: string;
        loyaltyDashboardUrl: string;
    };
}
```

### API Endpoints

```
POST   /api/pos/webhook                      -- Receive POS transaction data
GET    /api/pos/product/{barcode}            -- Lookup product for POS display
POST   /api/pos/transaction                  -- Create transaction record
GET    /api/receipts/{token}                 -- View digital receipt
POST   /api/receipts/{token}/review          -- Submit review from receipt
GET    /api/integrations/pos                 -- List POS integrations
POST   /api/integrations/pos                 -- Configure POS integration
```

### Supported POS Systems

1. **1C:Retail** - Most common in Russia
2. **ATOL** - Fiscal data operators
3. **Evotor** - Cloud POS
4. **Custom API** - Generic webhook integration

### Business Value
- Extends trust verification to post-purchase
- Captures purchase data for analytics
- Drives review collection at optimal moment
- Connects loyalty points to purchases
- Creates persistent digital touchpoint

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- Retail store registry database
- Basic store registration UI
- Store scan event tracking

### Phase 2: Kiosk Mode (Weeks 3-4)
- Kiosk device authentication
- Scanner interface
- Product display templates

### Phase 3: Marketing Materials (Weeks 5-6)
- Shelf talker generator
- Template library
- Batch generation

### Phase 4: Staff Portal (Weeks 7-8)
- Training module system
- Certification flow
- Staff mobile tools

### Phase 5: POS Integration (Weeks 9-10)
- Webhook infrastructure
- Receipt generation
- Initial POS partner integration

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Stores registered | 100 in 6 months | Database count |
| In-store scans | 10,000/month | Store scan events |
| Staff certified | 500 in 6 months | Certification records |
| Kiosk sessions | 5,000/month | Session table |
| POS integrations | 5 chains | Integration count |
| Reviews from receipts | 15% conversion | Receipt→review tracking |

---

## Integration Points with Existing Systems

### QR Code System
- Store scan events link to existing `qr_scan_events`
- Kiosk uses same QR generation service
- Shelf talkers use existing QR image endpoint

### Loyalty System
- Staff certification grants bonus points
- In-store scans earn consumer points
- POS purchases sync with loyalty ledger

### Status Levels
- All retail materials display current status
- Real-time status checks at kiosk/POS
- Status change notifications to retail partners

### Analytics
- Store performance integrates with existing analytics
- Staff metrics in organization dashboard
- Retail-specific reports for manufacturers

---

## Security Considerations

1. **Kiosk Authentication**: Device-specific tokens with IP binding
2. **POS Webhooks**: HMAC signature verification
3. **Staff Access**: Role-based permissions within store
4. **Receipt Tokens**: Short-lived, single-use for sensitive data
5. **Customer Privacy**: Phone/email hashing, opt-in only

---

*Document generated: Session 17 - Retail Features Brainstorm*
*Last updated: 2026-02-01*
