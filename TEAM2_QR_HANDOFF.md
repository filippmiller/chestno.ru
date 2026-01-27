# TEAM 2: QR IMPROVEMENTS HANDOFF

**Start Date:** Day 3 (or when Team 1 complete)
**Duration:** 1-2 days (10-12 hours)
**Team Size:** 1 developer
**Status:** READY TO START

---

## 📋 PREREQUISITES CHECKLIST

Before starting, verify:
- [ ] QR Analytics agent work is committed (check `git log --grep="QR"`)
- [ ] Backend QR image generation endpoints working
- [ ] Team 1 (Status Levels) is in testing phase (Day 3+) OR complete

---

## 🎯 WHAT'S ALREADY DONE

**From QR Analytics Agent (Session 1):**
- ✅ QR image generation backend (`backend/app/services/qr_generator.py`)
- ✅ API endpoints:
  - `GET /api/organizations/{org_id}/qr-codes/{qr_id}/image`
  - `GET /api/organizations/{org_id}/qr-business/image`
- ✅ ETag caching (24-hour TTL, 304 Not Modified support)
- ✅ Format support: PNG, SVG
- ✅ Size support: 100-2000 pixels
- ✅ Error correction: L, M, Q, H
- ✅ Test suite passing (6 scenarios)

**Files Created:**
- `backend/app/services/qr_generator.py` (91 lines)
- `backend/test_qr_generator_standalone.py` (test suite)
- `backend/SESSION_1_QR_IMAGE_GENERATION_COMPLETE.md` (docs)

**Files Modified:**
- `backend/app/api/routes/qr.py` (added image endpoint)
- `backend/app/api/routes/qr_business.py` (added business image endpoint)
- `backend/app/schemas/qr.py` (added QRImageParams schema)

---

## 🚀 YOUR TASKS (3 PHASES)

### **PHASE 1: Time-Series Analytics (3 hours)**

**Goal:** Add timeline charts showing QR scan trends over time

**Backend Tasks:**
1. Create database migration:
   ```sql
   -- File: supabase/migrations/0030_qr_timeline_index.sql
   CREATE INDEX IF NOT EXISTS idx_qr_events_timeline
   ON qr_events (qr_code_id, occurred_at DESC);
   ```

2. Implement service function:
   ```python
   # File: backend/app/services/qr.py (extend existing)

   def get_qr_timeline(
       qr_code_id: str,
       period: Literal['7d', '30d', '90d', '1y'] = '30d',
       user_id: str = None
   ) -> dict:
       """
       Returns time-series data for QR scans.

       Returns: {
           'period': '30d',
           'data': [
               {'date': '2026-01-01', 'count': 5},
               {'date': '2026-01-02', 'count': 8},
               ...
           ]
       }

       Note: Fills gaps with zero counts for missing dates.
       """
   ```

3. Add API endpoint:
   ```python
   # File: backend/app/api/routes/qr.py (extend existing)

   @router.get('/organizations/{org_id}/qr-codes/{qr_id}/timeline')
   async def get_qr_timeline_endpoint(
       org_id: str,
       qr_id: str,
       period: Literal['7d', '30d', '90d', '1y'] = Query('30d'),
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       # Verify org membership (ANALYTICS_ROLES)
       # Call get_qr_timeline()
       # Return QRTimeline response
   ```

**Frontend Tasks:**
4. Install dependency:
   ```bash
   cd frontend
   npm install recharts
   ```

5. Create timeline chart component:
   ```typescript
   // File: frontend/src/components/qr/QRTimelineChart.tsx

   import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

   interface QRTimelineChartProps {
     data: { date: string; count: number }[];
     period: '7d' | '30d' | '90d' | '1y';
   }

   export const QRTimelineChart: React.FC<QRTimelineChartProps> = ({ data, period }) => {
     // Format dates for display
     // Render responsive line chart
     // Add hover tooltips
   };
   ```

6. Add to QR management page:
   ```typescript
   // File: frontend/src/pages/OrganizationQr.tsx (modify existing)

   // Add state
   const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
   const [timelineData, setTimelineData] = useState<any>(null);

   // Add period selector buttons
   // Load timeline data when period changes
   // Render QRTimelineChart component
   ```

**Deliverables:**
- Timeline endpoint returns aggregated data
- Frontend chart displays scan trends
- Period selector (7d, 30d, 90d, 1y) works

---

### **PHASE 2: QR Customization (5 hours)**

**Goal:** Allow users to customize QR colors, logo, and style

**Backend Tasks:**
1. Create database migration:
   ```sql
   -- File: supabase/migrations/0030_qr_customization.sql

   CREATE TABLE qr_customization_settings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     qr_code_id UUID NOT NULL UNIQUE REFERENCES qr_codes(id) ON DELETE CASCADE,
     foreground_color TEXT NOT NULL DEFAULT '#000000',
     background_color TEXT NOT NULL DEFAULT '#FFFFFF',
     logo_url TEXT,
     logo_size_percent INT CHECK (logo_size_percent BETWEEN 10 AND 30) DEFAULT 20,
     style TEXT CHECK (style IN ('squares', 'dots', 'rounded')) DEFAULT 'squares',
     contrast_ratio DECIMAL(4,2),
     is_valid BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );

   CREATE INDEX idx_qr_customization ON qr_customization_settings(qr_code_id);

   -- RLS policies
   ALTER TABLE qr_customization_settings ENABLE ROW LEVEL SECURITY;

   -- Policy: Org members can view their QR customizations
   -- Policy: Org admins can update their QR customizations
   ```

2. Implement contrast calculation:
   ```python
   # File: backend/app/services/qr.py (extend)

   def calculate_contrast_ratio(fg_color: str, bg_color: str) -> float:
       """
       Calculate WCAG contrast ratio between two hex colors.
       Returns value between 1.0 (no contrast) and 21.0 (maximum).
       WCAG AA requires ≥3.0 for QR codes.
       """
       # Parse hex to RGB
       # Calculate relative luminance
       # Calculate contrast ratio
       # Return float
   ```

3. Implement CRUD functions:
   ```python
   # File: backend/app/services/qr.py (extend)

   def get_qr_customization(qr_code_id: str, user_id: str) -> dict | None:
       pass

   def update_qr_customization(
       qr_code_id: str,
       user_id: str,
       foreground_color: str,
       background_color: str,
       logo_url: str | None = None,
       logo_size_percent: int = 20,
       style: str = 'squares'
   ) -> dict:
       # Calculate contrast ratio
       # Validate ≥3.0 (WCAG AA)
       # Upsert customization
       # Return settings
   ```

4. Add API endpoints:
   ```python
   # File: backend/app/api/routes/qr.py (extend)

   @router.get('/qr-codes/{qr_id}/customization')
   async def get_qr_customization_endpoint(...):
       pass

   @router.put('/qr-codes/{qr_id}/customization')
   async def update_qr_customization_endpoint(...):
       pass

   @router.delete('/qr-codes/{qr_id}/customization')
   async def delete_qr_customization_endpoint(...):
       pass
   ```

**Frontend Tasks:**
5. Install dependency:
   ```bash
   cd frontend
   npm install react-colorful
   ```

6. Create customizer component:
   ```typescript
   // File: frontend/src/components/qr/QRCustomizer.tsx

   import { HexColorPicker } from 'react-colorful';
   import QRCodeSVG from 'qrcode.react';

   interface QRCustomizerProps {
     qrUrl: string;
     currentSettings?: QRCustomizationSettings;
     onSave: (settings: QRCustomizationUpdate) => void;
   }

   export const QRCustomizer: React.FC<QRCustomizerProps> = ({ qrUrl, currentSettings, onSave }) => {
     const [fgColor, setFgColor] = useState('#000000');
     const [bgColor, setBgColor] = useState('#FFFFFF');
     const [logo, setLogo] = useState<File | null>(null);
     const [style, setStyle] = useState<'squares' | 'dots' | 'rounded'>('squares');

     // Calculate contrast ratio client-side
     const contrastRatio = calculateContrastRatio(fgColor, bgColor);
     const isValid = contrastRatio >= 3.0;

     // Render color pickers
     // Render logo upload
     // Render style radio buttons
     // Render preview with QRCodeSVG
     // Show warning if contrast < 3.0
     // Disable save if invalid
   };
   ```

7. Add to QR management page:
   ```typescript
   // File: frontend/src/pages/OrganizationQr.tsx (modify)

   // Add "Customize" button on each QR card
   // Open modal with QRCustomizer
   // Handle save callback
   // Update QR preview with custom design
   ```

**Deliverables:**
- Users can customize QR colors (with contrast validation)
- Users can upload logo (to Supabase Storage `qr-logos` bucket)
- Users can select style (squares/dots/rounded)
- Preview shows custom QR before saving
- Warning appears if contrast < 3.0 (WCAG AA)

---

### **PHASE 3: Batch Operations (4 hours)**

**Goal:** Allow bulk QR creation and export

**Backend Tasks:**
1. Implement bulk create:
   ```python
   # File: backend/app/services/qr.py (extend)

   def bulk_create_qr_codes(
       organization_id: str,
       labels: list[str],  # Max 50
       user_id: str
   ) -> list[dict]:
       """
       Create multiple QR codes at once.

       Validates:
       - Max 50 QR codes per batch
       - Subscription quota not exceeded
       - User has manager role

       Returns list of created QR codes.
       """
       # Check batch size <= 50
       # Check subscription limits
       # Loop through labels and create QR codes
       # Return list of created QRs
   ```

2. Implement bulk export:
   ```python
   # File: backend/app/services/qr.py (extend)

   def generate_qr_images_zip(
       qr_code_ids: list[str],
       organization_id: str,
       user_id: str
   ) -> bytes:
       """
       Generate ZIP file containing QR code images.

       Returns ZIP file bytes.
       """
       # Verify all QR codes belong to organization
       # Generate QR images (PNG 500x500)
       # Apply customization if exists
       # Create ZIP in memory
       # Return bytes
   ```

3. Add API endpoints:
   ```python
   # File: backend/app/api/routes/qr.py (extend)

   @router.post('/organizations/{org_id}/qr-codes/bulk-create')
   async def bulk_create_qr_codes_endpoint(
       org_id: str,
       body: BulkCreateRequest,  # { labels: string[] }
       current_user_id: str = Depends(...)
   ):
       # Validate max 50
       # Call bulk_create_qr_codes()
       # Return created QRs

   @router.get('/organizations/{org_id}/qr-codes/export')
   async def export_qr_codes_endpoint(
       org_id: str,
       qr_ids: str = Query(...),  # Comma-separated IDs
       current_user_id: str = Depends(...)
   ):
       # Parse qr_ids
       # Call generate_qr_images_zip()
       # Return StreamingResponse with ZIP
   ```

**Frontend Tasks:**
4. Create bulk create modal:
   ```typescript
   // File: frontend/src/components/qr/BulkCreateModal.tsx

   interface BulkCreateModalProps {
     organizationId: string;
     onSuccess: (qrCodes: QRCode[]) => void;
     onClose: () => void;
   }

   export const BulkCreateModal: React.FC<BulkCreateModalProps> = ({ organizationId, onSuccess, onClose }) => {
     const [labels, setLabels] = useState<string>('');  // Textarea, one per line
     const [csvFile, setCsvFile] = useState<File | null>(null);

     // Parse CSV and fill textarea
     // Show preview table
     // Show count: "Will create: X QR codes"
     // Show quota: "Available: Y of Z"
     // Disable submit if quota exceeded
     // Show progress bar during creation
   };
   ```

5. Add selection mode to QR management page:
   ```typescript
   // File: frontend/src/pages/OrganizationQr.tsx (modify)

   // Add state: selectedQrIds, selectionMode
   // Add "Select Multiple" button
   // Render checkboxes on QR cards when in selection mode
   // Add "Select All" / "Deselect All" buttons
   // Show counter: "Selected: X of Y"
   // Add "Export Selected" button
   // Add dropdown for export format (PNG/PDF/CSV)
   // Handle export: call API, trigger download
   // Add "Bulk Create" button → open BulkCreateModal
   ```

**Deliverables:**
- Bulk create modal allows creating up to 50 QR codes
- CSV upload parses labels and populates form
- Selection mode allows selecting multiple QR codes
- Export generates ZIP file with PNG images
- Quota validation prevents exceeding limits

---

## 📁 FILES YOU'LL CREATE/MODIFY

**New Files:**
```
supabase/migrations/
├── 0030_qr_timeline_index.sql
└── 0030_qr_customization.sql

frontend/src/components/qr/
├── QRTimelineChart.tsx
├── QRCustomizer.tsx
└── BulkCreateModal.tsx

frontend/src/types/
└── qr.ts (extend with timeline and customization types)

frontend/src/api/
└── qrService.ts (extend with new endpoints)
```

**Modified Files:**
```
backend/app/services/qr.py
backend/app/api/routes/qr.py
backend/app/schemas/qr.py
frontend/src/pages/OrganizationQr.tsx
```

---

## 🧪 TESTING CHECKLIST

**Phase 1 Tests:**
- [ ] Timeline endpoint returns data for 7d, 30d, 90d, 1y periods
- [ ] Timeline fills gaps with zero counts for missing dates
- [ ] Chart renders correctly in browser
- [ ] Period selector changes data
- [ ] Mobile responsive

**Phase 2 Tests:**
- [ ] Contrast calculation accurate (test with known values)
- [ ] Low contrast (< 3.0) shows warning and disables save
- [ ] High contrast (≥ 3.0) allows save
- [ ] Logo upload works (Supabase Storage)
- [ ] Custom QR preview renders correctly
- [ ] Saved QR uses custom colors/logo

**Phase 3 Tests:**
- [ ] Bulk create validates max 50 limit
- [ ] Bulk create checks subscription quota
- [ ] CSV upload parses correctly
- [ ] Export generates valid ZIP
- [ ] ZIP contains PNG images (one per QR)
- [ ] Selection mode UI works

---

## 🚀 READY TO START PROMPT

**Copy this into PowerShell when ready to start Team 2:**

```powershell
QR Improvements complete system (Phase 1-3). Coordinate with existing QR Analytics work. Tasks: Phase 1 (time-series analytics: database migration idx_qr_events_timeline, implement get_qr_timeline service function with period support 7d/30d/90d/1y and gap filling, add GET /api/qr-codes/:id/timeline endpoint, create QRTimelineChart component with recharts LineChart, add period selector UI), Phase 2 (QR customization: create migration qr_customization_settings table with WCAG contrast validation, implement calculate_contrast_ratio function, add get/update/delete_qr_customization service functions, create GET/PUT/DELETE /api/qr-codes/:id/customization endpoints, install react-colorful, build QRCustomizer component with HexColorPicker and logo upload to Supabase Storage qr-logos bucket, add contrast validation ≥3.0 warning), Phase 3 (batch operations: implement bulk_create_qr_codes max 50 with quota validation, implement generate_qr_images_zip with customization support, add POST /api/qr-codes/bulk-create endpoint, add GET /api/qr-codes/export endpoint returning StreamingResponse ZIP, create BulkCreateModal component with CSV upload parser, add selection mode to OrganizationQr page with checkboxes and Select All/Deselect All, add Export Selected button with format dropdown PNG/PDF/CSV). Read IMPL_QR_Improvements_v1.md and TEAM2_QR_HANDOFF.md. Duration: 10-12 hours (1-2 days). INDEPENDENT work.
```

---

## 📞 SUPPORT

**If blocked:**
1. Check `IMPL_QR_Improvements_v1.md` for detailed specs
2. Review `backend/SESSION_1_QR_IMAGE_GENERATION_COMPLETE.md` for existing work
3. Test existing QR endpoints first before building on them
4. Document blockers in `SPRINT_PROGRESS.md`

**Integration with Team 1 (Status Levels):**
- No direct integration needed
- QR system is independent

**Integration with Team 3 (Payments):**
- QR creation quota check needs subscription service
- Coordinate: `can_create_qr(org_id, count)` function signature

---

**Status:** READY TO START (after Team 1 reaches Day 3 or completes)
**Expected Completion:** 1-2 days after start
**Estimated Hours:** 10-12 hours
