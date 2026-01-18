# Product Catalog

> Last updated: 2026-01-18
> Domain: products
> Keywords: product, catalog, item, pricing, featured, inventory

## Overview

Product catalog for organizations with pricing, categories, and media support.
Products go through draft/published/archived lifecycle.

---

## Product Lifecycle

```
1. Editor creates product with status='draft'
2. Fill details: name, description, pricing, images
3. Set category and tags
4. When ready: status='published'
5. Published products visible on public catalog
6. Can mark as featured (is_featured=true)
7. Archive when discontinued: status='archived'
```

---

## Database Table

### products
**File:** `supabase/migrations/0013_products.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| organization_id | uuid | Owner organization |
| slug | text | URL identifier |
| name | text | Required |
| short_description | text | Brief summary |
| long_description | text | Full details |
| category | text | Product category |
| tags | text | Comma-separated tags |
| price_cents | integer | Price in cents |
| currency | text | DEFAULT 'RUB' |
| status | text | 'draft', 'published', 'archived' |
| is_featured | boolean | Highlighted product |
| main_image_url | text | Primary image |
| gallery | jsonb | Additional images |
| external_url | text | Link to shop/marketplace |
| created_by | uuid | Creator user |
| updated_by | uuid | Last updater |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Constraint:** UNIQUE(organization_id, slug)

---

## Backend Service

### products.py
**File:** `backend/app/services/products.py`

**Organization Functions:**
```python
list_products(org_id, user_id, status_filter, limit, offset)
# List products with status filter
# Requires org membership

create_product(org_id, user_id, payload)
# Create new product
# Checks subscription quota
# Requires editor+ role

get_product(org_id, product_id, user_id)
# Get single product
# Requires org membership

update_product(org_id, product_id, user_id, payload)
# Update product
# Requires editor+ role

archive_product(org_id, product_id, user_id)
# Set status='archived'
# Requires editor+ role
```

**Public Functions:**
```python
list_public_products_by_org_slug(slug)
# List published products for public org

get_public_product_by_slug(slug)
# Get single product by slug
```

---

## API Endpoints

### Organization (Authenticated)
| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| GET | `/api/organizations/{org_id}/products` | List products | Member |
| POST | `/api/organizations/{org_id}/products` | Create product | Editor+ |
| GET | `/api/organizations/{org_id}/products/{id}` | Get product | Member |
| PUT | `/api/organizations/{org_id}/products/{id}` | Update product | Editor+ |
| POST | `/api/organizations/{org_id}/products/{id}/archive` | Archive | Editor+ |

### Public
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/public/organizations/{slug}/products` | Published products |
| GET | `/api/public/products/{slug}` | Single product |

---

## Frontend Pages

### OrganizationProducts.tsx
**Route:** `/dashboard/organization/products`
**Purpose:** Product catalog management
**Features:**
- Product grid/list view
- Status tabs (draft/published/archived)
- Create new button
- Edit/archive actions
- Featured toggle

### ProductsCatalog.tsx
**Route:** `/products`
**Purpose:** Public product catalog
**Features:**
- Browse all public products
- Filter by category
- Search functionality

---

## Types

### Product Schema
```typescript
interface Product {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  category: string | null;
  tags: string | null;
  price_cents: number | null;
  currency: string;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  main_image_url: string | null;
  gallery: GalleryItem[] | null;
  external_url: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
```

### Create/Update Request
```typescript
interface ProductCreate {
  name: string;
  slug: string;
  short_description?: string;
  long_description?: string;
  category?: string;
  tags?: string;
  price_cents?: number;
  currency?: string;
  status?: 'draft' | 'published' | 'archived';
  is_featured?: boolean;
  main_image_url?: string;
  gallery?: GalleryItem[];
  external_url?: string;
}
```

---

## Pricing Format

Prices stored in cents to avoid floating point issues:
- `price_cents: 9999` = 99.99 RUB
- Display: `price_cents / 100` with currency symbol

**Currency options:** RUB (default), USD, EUR

---

## Media Management

### Main Image
- Bucket: `org-media`
- Path: `products/{org_id}/{product_id}/main.{ext}`
- Upload: `uploadProductImage()`

### Gallery
- Bucket: `org-media`
- Path: `products/{org_id}/{product_id}/gallery/{filename}`
- Upload: `uploadProductGalleryImage()`

---

## Subscription Limits

Product creation respects subscription limits:
- Free: 5 products
- Standard: 50 products
- Pro: Unlimited

**Check function:**
```python
check_org_limit(org_id, 'products')
# Returns: (allowed: bool, current: int, max: int)
```

---

## External Links

Products can link to external shops/marketplaces:
- `external_url` field stores destination
- Displayed as "Buy" button on product page
- Analytics can track clicks (future feature)

---

## Featured Products

- `is_featured: true` marks product as highlighted
- Featured products appear first in listings
- Used for promotions and new arrivals

---

## RLS Policies

**Public read:** Published products from verified organizations
**Internal read:** All products for organization members
**Write/Update/Archive:** Editor+ roles only

---

## Product Variants System

> Added: 2026-01-18
> Migration: `0024_product_variants.sql`

### Overview

Products can have variants (sizes, colors, etc.) using parent-child relationships.
Variants share core details with parent but have unique SKU, barcode, price, and attributes.

### Variant Columns on Products Table

| Column | Type | Notes |
|--------|------|-------|
| parent_product_id | uuid | FK to parent product |
| is_variant | boolean | DEFAULT false |
| sku | text | Stock keeping unit |
| barcode | text | Product barcode |
| stock_quantity | integer | Inventory count |

### Variant Attributes Table

**Table:** `product_variant_attributes`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| product_id | uuid | FK to products |
| attribute_name | text | e.g., 'size', 'color' |
| attribute_value | text | e.g., 'M', 'Blue' |
| display_order | integer | Sorting order |

### Attribute Templates Table

**Table:** `product_attribute_templates`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| organization_id | uuid | Owner org |
| attribute_name | text | e.g., 'Size' |
| possible_values | text[] | ['S', 'M', 'L', 'XL'] |
| is_required | boolean | |
| display_order | integer | |

### Variant API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/organizations/{org}/products/{id}/with-variants` | Product + variants |
| GET | `/api/organizations/{org}/products/{id}/variants` | List variants |
| POST | `/api/organizations/{org}/products/{id}/variants` | Create variant |
| POST | `/api/organizations/{org}/products/{id}/variants/bulk` | Bulk create |
| DELETE | `/api/organizations/{org}/variants/{id}` | Delete variant |

### Attribute Template Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/organizations/{org}/attribute-templates` | List templates |
| POST | `/api/organizations/{org}/attribute-templates` | Create template |
| DELETE | `/api/organizations/{org}/attribute-templates/{id}` | Delete template |

---

## Bulk Import System

> Added: 2026-01-18
> Migration: `0025_bulk_imports.sql`

### Overview

Import products from CSV, Excel, and platform-specific exports:
- Wildberries (XLSX)
- Ozon (XLS/CSV)
- 1C (XML/CSV)
- Generic CSV/XLSX

### Import Jobs Table

**Table:** `import_jobs`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| organization_id | uuid | Owner org |
| created_by | uuid | Creator user |
| source_type | text | 'wildberries', 'ozon', '1c', 'generic_csv', 'generic_xlsx' |
| source_filename | text | Original filename |
| status | text | 'pending', 'mapping', 'validating', 'preview', 'processing', 'completed', 'failed', 'cancelled' |
| field_mapping | jsonb | Column → field mapping |
| total_rows | integer | Total rows in file |
| processed_rows | integer | Rows processed |
| successful_rows | integer | Products created |
| failed_rows | integer | Rows with errors |
| validation_errors | jsonb | Error details |
| skip_duplicates | boolean | Skip existing slugs |
| update_existing | boolean | Update existing products |
| download_images | boolean | Download image URLs |

### Image Queue Table

**Table:** `import_image_queue`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| job_id | uuid | FK to import_jobs |
| product_id | uuid | FK to products |
| source_url | text | Image URL |
| target_type | text | 'main' or 'gallery' |
| status | text | 'pending', 'downloading', 'completed', 'failed' |
| result_url | text | Supabase storage URL |

### Import Parsers

**Location:** `backend/app/services/import_parsers/`

| Parser | File | Formats |
|--------|------|---------|
| Base | base.py | Abstract interface |
| Generic | generic.py | CSV, XLSX |
| Wildberries | wildberries.py | XLSX (Артикул, Наименование, Цена) |
| Ozon | ozon.py | XLS/CSV (offer_id, name, price) |
| 1C | one_c.py | XML/CSV (Номенклатура, Артикул) |

### Import API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/organizations/{org}/imports/upload` | Upload file, create job |
| GET | `/api/organizations/{org}/imports` | List import jobs |
| GET | `/api/organizations/{org}/imports/{id}` | Get job details |
| GET | `/api/organizations/{org}/imports/{id}/mapping` | Get field mapping info |
| POST | `/api/organizations/{org}/imports/{id}/mapping` | Save field mapping |
| POST | `/api/organizations/{org}/imports/{id}/validate` | Run validation |
| GET | `/api/organizations/{org}/imports/{id}/preview` | Preview mapped data |
| POST | `/api/organizations/{org}/imports/{id}/execute` | Start import |
| POST | `/api/organizations/{org}/imports/{id}/cancel` | Cancel job |

### Import Wizard Steps

```
1. Source Selection - Choose import source (Wildberries, Ozon, etc.)
2. File Upload - Upload CSV/XLSX file
3. Field Mapping - Map source columns to product fields
4. Preview - Review mapped data, configure settings
5. Processing - Import execution with progress
6. Results - Summary with success/failure counts
```

### Frontend Files

| File | Purpose |
|------|---------|
| OrganizationProductImport.tsx | Import wizard page |
| ImportWizard.tsx | Multi-step wizard component |
| ImportSourceSelector.tsx | Source selection UI |
| ImportFieldMapper.tsx | Column mapping UI |
| ImportPreviewTable.tsx | Data preview table |
| ImportProgressTracker.tsx | Progress display |

### Image Downloader Service

**File:** `backend/app/services/image_downloader.py`

**Functions:**
```python
download_image(url)           # Download with retries
validate_image(data)          # Validate format/size
process_image(data)           # Resize, convert to WebP
create_thumbnail(data)        # Generate 200x200 thumb
upload_to_supabase(data, path) # Upload to storage
download_and_upload_image()   # Full pipeline
```

**Features:**
- Automatic WebP conversion
- Thumbnail generation (200x200)
- Retry with exponential backoff
- Concurrent batch processing
