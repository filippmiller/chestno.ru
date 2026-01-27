# Image Requirements for Status Levels Info Page

## Required Images

### 1. Open Graph / Social Media Image
**File:** `status-levels-og.jpg`
**Size:** 1200x630px
**Format:** JPG (optimized for web)
**Purpose:** Social media previews (Facebook, Twitter, LinkedIn)

**Content:**
- Show all three status badges (A, B, C) prominently
- Include headline: "Система уровней доверия"
- Brand colors: Green (#10B981), Blue (#3B82F6), Purple (#9333EA)
- Logo "Честно.ру" in corner
- Clean, professional design

---

### 2. Hero Section Background (Optional)
**File:** `status-levels-hero-bg.svg` or pattern
**Size:** Vector or large PNG (2400x1200px)
**Format:** SVG (preferred) or PNG
**Purpose:** Decorative background for hero section

**Content:**
- Abstract geometric pattern
- Subtle gradients matching brand colors
- Light/transparent overlay-friendly
- Should not distract from text

---

### 3. Status Badge Icons (High-Res)
**Files:**
- `badge-level-a.svg` (Green)
- `badge-level-b.svg` (Blue)
- `badge-level-c.svg` (Purple)

**Size:** 256x256px (vector)
**Format:** SVG
**Purpose:** High-quality badge displays throughout the page

**Design Specs:**
- **Level A:** Green circle (#10B981) with white "A" (bold, centered)
- **Level B:** Blue circle (#3B82F6) with white "B" (bold, centered)
- **Level C:** Purple circle (#9333EA) with white "C" (bold, centered)
- Add subtle shadow/glow effect matching badge color
- Ensure readability at all sizes (16px to 256px)

---

### 4. Success Story Placeholder Logos
**Files:**
- `success-story-1.jpg` (Керамика)
- `success-story-2.jpg` (ЭкоМёд)
- `success-story-3.jpg` (Текстиль)

**Size:** 200x200px
**Format:** JPG or PNG
**Purpose:** Organization logos in success stories section

**Content:**
- Professional business logos or product photos
- Square crop (1:1 aspect ratio)
- High quality, well-lit
- Background: white or transparent

**Fallback:**
- Currently using gradient circles with initials (implemented in code)
- Can be replaced with actual logos when available

---

### 5. Statistics Icons (Optional Enhancement)
**Files:**
- `icon-users.svg`
- `icon-trending-up.svg`
- `icon-zap.svg`

**Size:** 64x64px (vector)
**Format:** SVG
**Purpose:** Visual enhancement for statistics cards

**Note:** Currently using Lucide React icons. Can be replaced with custom icons for brand consistency.

---

## Implementation Priority

### Phase 1 (Critical)
1. Open Graph image (`status-levels-og.jpg`) - for social sharing
2. Status badge icons (SVG) - for page clarity

### Phase 2 (Enhanced)
3. Success story logos - for authenticity
4. Hero background pattern - for visual appeal

### Phase 3 (Optional)
5. Custom statistics icons - for brand consistency

---

## Current Status

**Implemented:**
- ✅ Badge components using CSS (green/blue/purple circles with text)
- ✅ Icon library (Lucide React) for UI icons
- ✅ Gradient placeholders for success story logos
- ✅ Responsive layouts (no image dependencies)

**Pending:**
- ⏳ Open Graph social media image
- ⏳ Professional success story photos
- ⏳ Custom SVG badges (currently using CSS)

---

## Image Optimization Guidelines

1. **File Size:**
   - Keep all images under 200KB
   - Use modern formats (WebP with JPG fallback)
   - Implement lazy loading for below-fold images

2. **Responsive Images:**
   - Provide 1x, 2x, 3x versions for retina displays
   - Use `srcset` for different screen sizes
   - Implement blur-up placeholder technique

3. **Accessibility:**
   - All images must have descriptive `alt` text
   - Decorative images should have `alt=""`
   - Icons should be accompanied by text labels

4. **Loading Strategy:**
   - Hero images: eager loading (above fold)
   - Success stories: lazy loading (below fold)
   - Social media images: preload in `<head>`

---

## Design Files Location

When creating these images, save the source files to:
- **Figma/Sketch:** `/design/status-levels/`
- **Exported assets:** `/frontend/public/images/status-levels/`
- **Optimized web:** `/frontend/public/images/status-levels/optimized/`

---

## Brand Colors Reference

```css
/* Status Level Colors */
--level-a-green: #10B981;
--level-b-blue: #3B82F6;
--level-c-purple: #9333EA;

/* Brand Colors */
--primary: #2563EB;
--accent: #F59E0B;
--background: #FFFFFF;
--foreground: #0F172A;
--muted: #64748B;
```

---

## Notes for Designer

1. All badges should have consistent visual weight
2. Maintain 60:40 dark/light ratio for accessibility
3. Use Montserrat or similar sans-serif font for badge letters
4. Ensure contrast ratio ≥ 4.5:1 (WCAG AA standard)
5. Test badges on both light and dark backgrounds
6. Export with transparent backgrounds where applicable
