# Marketing Materials

> Last updated: 2026-01-18
> Domain: marketing
> Keywords: marketing, template, poster, flyer, layout, design, print

## Overview

Marketing material system with templates and customizable layouts.
Organizations can create printable materials (posters, flyers) with their
branding and QR codes.

---

## System Components

```
Templates (Global) → Materials (Per-Organization)
       ↓                        ↓
   Blueprint with         Customized layout
   default layout         for printing
```

---

## Database Tables

### marketing_templates
**Purpose:** Global template blueprints
**File:** `supabase/migrations/0023_marketing_materials.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| template_key | text | Unique identifier |
| name | text | Display name |
| description | text | Template description |
| paper_size | text | 'A3', 'A4', 'A5' |
| orientation | text | 'portrait', 'landscape' |
| layout_schema_version | integer | Layout format version |
| layout_json | jsonb | Default layout definition |
| thumbnail_url | text | Preview image |
| is_active | boolean | Available for use |
| sort_order | integer | Display order |

**Seeded Templates:**
- `poster_door` - A4 portrait for doors/displays
- `flyer_a5` - A5 portrait for distribution
- `info_a4_landscape` - A4 landscape for counters

### marketing_materials
**Purpose:** Organization-specific materials
**File:** `supabase/migrations/0023_marketing_materials.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| business_id | uuid | Owner organization |
| template_id | uuid | Base template (optional) |
| name | text | Material name |
| paper_size | text | 'A3', 'A4', 'A5' |
| orientation | text | 'portrait', 'landscape' |
| layout_schema_version | integer | |
| layout_json | jsonb | Customized layout |
| is_default_for_business | boolean | Default material |
| support_notes | text | Internal notes |
| created_by_user_id | uuid | Creator |
| updated_by_user_id | uuid | Last updater |

---

## Layout JSON Structure

### Schema
```typescript
interface LayoutJson {
  version: number;
  paper: {
    size: 'A3' | 'A4' | 'A5';
    orientation: 'portrait' | 'landscape';
    width_mm: number;
    height_mm: number;
  };
  theme?: {
    primary_color?: string;
    background_color?: string;
  };
  blocks: LayoutBlock[];
}

interface LayoutBlock {
  id: string;
  type: 'logo' | 'text' | 'qr' | 'image' | 'shape';

  // Position (percentage of paper size)
  x: number;
  y: number;
  width: number;
  height: number;

  // Binding to dynamic data
  binding?: string;  // e.g., 'business.name', 'business.logo_url'

  // Text properties
  text?: string;
  fontFamily?: string;
  fontSizePt?: number;
  fontWeight?: string;
  align?: 'left' | 'center' | 'right';
  color?: string;

  // QR properties
  qr_url?: string;

  // Edit permissions
  editable_by_business?: boolean;
  editable_by_support?: boolean;
}
```

### Block Types

**logo** - Organization logo image
```json
{
  "type": "logo",
  "binding": "business.logo_url",
  "x": 10, "y": 5, "width": 20, "height": 10
}
```

**text** - Static or dynamic text
```json
{
  "type": "text",
  "binding": "business.name",
  "fontSizePt": 24,
  "fontWeight": "bold",
  "align": "center",
  "color": "#000000"
}
```

**qr** - QR code block
```json
{
  "type": "qr",
  "binding": "business.qr_url",
  "x": 35, "y": 60, "width": 30, "height": 30
}
```

**image** - Custom image
```json
{
  "type": "image",
  "binding": "custom.hero_image",
  "x": 0, "y": 0, "width": 100, "height": 40
}
```

**shape** - Decorative element
```json
{
  "type": "shape",
  "shape": "rectangle",
  "fill": "#f0f0f0",
  "x": 0, "y": 0, "width": 100, "height": 100
}
```

---

## Backend Service

### marketing.py
**File:** `backend/app/services/marketing.py`

**Template Functions:**
```python
list_templates()
# List active templates

get_template(template_id)
# Get template details
```

**Material Functions:**
```python
list_materials(org_id, user_id)
# List organization's materials

get_material(org_id, material_id, user_id)
# Get single material

create_material(org_id, user_id, template_id, name)
# Create from template

update_material(org_id, material_id, user_id, layout_json)
# Update layout

delete_material(org_id, material_id, user_id)
# Delete material
```

---

## API Endpoints

### Templates (Public)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/marketing/templates` | List templates |
| GET | `/api/marketing/templates/{id}` | Get template |

### Materials (Authenticated)
| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| GET | `/api/organizations/{org_id}/marketing-materials` | List materials | Member |
| GET | `/api/organizations/{org_id}/marketing-materials/{id}` | Get material | Member |
| POST | `/api/organizations/{org_id}/marketing-materials` | Create | Editor+ |
| PUT | `/api/organizations/{org_id}/marketing-materials/{id}` | Update | Editor+ |
| DELETE | `/api/organizations/{org_id}/marketing-materials/{id}` | Delete | Editor+ |

---

## Frontend Pages

### OrganizationMarketing.tsx
**Route:** `/dashboard/organization/marketing`
**Purpose:** Marketing materials list
**Features:**
- Browse available templates
- View created materials
- Create new from template
- Delete materials

### OrganizationMarketingEdit.tsx
**Route:** `/dashboard/organization/marketing/:materialId`
**Purpose:** Edit material layout
**Features:**
- Visual layout editor
- Block positioning
- Text editing
- Preview

### OrganizationQrPoster.tsx
**Route:** `/dashboard/organization/marketing/qr-poster`
**Purpose:** Quick QR poster creation
**Features:**
- Select template
- Customize with org data
- Download/print

---

## Frontend Components

### LayoutRenderer.tsx
**File:** `frontend/src/components/marketing/LayoutRenderer.tsx`
**Purpose:** Render layout JSON to visual output

**Props:**
```typescript
interface LayoutRendererProps {
  layout: LayoutJson;
  businessData: {
    name: string;
    logo_url: string;
    qr_url: string;
    // ... other org data
  };
  scale?: number;
  editable?: boolean;
  onBlockUpdate?: (blockId: string, updates: Partial<LayoutBlock>) => void;
}
```

---

## Types

### Frontend Types
**File:** `frontend/src/types/marketing.ts`

```typescript
interface MarketingTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  paper_size: 'A3' | 'A4' | 'A5';
  orientation: 'portrait' | 'landscape';
  layout_schema_version: number;
  layout_json: LayoutJson;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface MarketingMaterial {
  id: string;
  business_id: string;
  template_id: string | null;
  name: string;
  paper_size: 'A3' | 'A4' | 'A5';
  orientation: 'portrait' | 'landscape';
  layout_schema_version: number;
  layout_json: LayoutJson;
  is_default_for_business: boolean;
  support_notes: string | null;
  created_by_user_id: string;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## Paper Sizes

| Size | Portrait (mm) | Landscape (mm) |
|------|---------------|----------------|
| A3 | 297 × 420 | 420 × 297 |
| A4 | 210 × 297 | 297 × 210 |
| A5 | 148 × 210 | 210 × 148 |

---

## Dynamic Bindings

Bindings resolve org data at render time:

| Binding | Source |
|---------|--------|
| `business.name` | organizations.name |
| `business.logo_url` | organization_profiles.main_image_url |
| `business.qr_url` | Generated QR code URL |
| `business.phone` | organization_profiles.contact_phone |
| `business.website` | organizations.website_url |
| `business.address` | organization_profiles.contact_address |
