# Frontend Components

> Last updated: 2026-01-28
> Domain: frontend
> Keywords: component, react, ui, tsx, reusable, shadcn

## Overview

Components in `frontend/src/components/`. Mix of shadcn/ui base components
and custom feature components.

---

## System Components

### AppErrorBoundary
**Purpose:** Global error boundary wrapper with fallback UI and reload/home actions
**Location:** `frontend/src/components/AppErrorBoundary.tsx`

---

## UI Components (shadcn/ui)

**Location:** `frontend/src/components/ui/`

### Core Elements
- **button.tsx** - Styled buttons with variants (default, destructive, outline, secondary, ghost, link)
- **input.tsx** - Text input fields
- **textarea.tsx** - Multi-line text inputs
- **label.tsx** - Form labels
- **checkbox.tsx** - Radix UI checkbox (uses `onCheckedChange` not `onChange`)
- **badge.tsx** - Tag/label badges

### Selection & Dropdowns
- **select.tsx** - Dropdown select component (Select, SelectTrigger, SelectValue, SelectContent, SelectItem)
- **dropdown-menu.tsx** - Full dropdown menu with items, separators, labels, shortcuts

### Layout
- **card.tsx** - Card container (CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- **dialog.tsx** - Modal dialogs (Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter)
- **tabs.tsx** - Tab navigation (Tabs, TabsList, TabsTrigger, TabsContent)
- **alert.tsx** - Alert/notification boxes with variants (default, destructive)
- **collapsible.tsx** - Collapsible/expandable panels (Collapsible, CollapsibleTrigger, CollapsibleContent)
- **table.tsx** - Data table components (Table, TableHeader, TableBody, TableRow, TableHead, TableCell)

### Feedback
- **progress.tsx** - Progress bar with percentage indicator

### Form Integration
- **form.tsx** - React Hook Form integration with error handling
  - Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage

### Navigation
- **navbar.tsx** - Top navigation bar component

### Custom UI
- **MadeInRussiaStamp.tsx** - Custom stamp badge component
- **RussianFlag.tsx** - Flag icon component

---

## Landing Page Components

**Location:** `frontend/src/components/landing/`

### LandingHeader.tsx
**Purpose:** Top navigation bar for public pages
**Features:**
- Logo/branding
- Navigation links
- User menu (login/logout)
- Admin links for privileged users

### LandingHero.tsx
**Purpose:** Hero section with main CTA

### LandingCategories.tsx
**Purpose:** Product categories showcase

### LandingHowItWorks.tsx
**Purpose:** Feature explanation with steps

### LandingStories.tsx
**Purpose:** User testimonials/success stories

### LandingFooter.tsx
**Purpose:** Footer with links and copyright

---

## Admin Components

**Location:** `frontend/src/components/admin/`

### AdminOrganizationsSection.tsx
**Purpose:** Organization management table and actions

### AdminSubscriptionPlansSection.tsx
**Purpose:** Plan CRUD interface

### BusinessDetailsDialog.tsx
**Purpose:** Modal for viewing/editing business details

---

## Feature Components

### MediaUploader.tsx
**Purpose:** File upload component for images/videos
**Features:**
- Supports multiple file types
- Progress indication
- File size and type validation
- Integration with Supabase Storage

### RichTextEditor.tsx
**Purpose:** Rich text editor for posts/reviews
**Features:**
- Bold, italic, underline
- Links
- Lists (ordered/unordered)
- Headings

---

## QR Components

**Location:** `frontend/src/components/qr/`

### BusinessQrCode.tsx
**Purpose:** QR code display and generation

### QRGeoMap.tsx
**Purpose:** Map visualization of QR scan locations

---

## Widget Components

### WidgetConfigurator.tsx
**Location:** `frontend/src/pages/WidgetConfigurator.tsx`
**Route:** `/dashboard/organization/widget`
**Purpose:** Configure and generate embeddable trust badge widgets
**Features:**
- Live widget preview with iframe
- Size selection (small, medium, large)
- Theme selection (light, dark, auto)
- Custom primary color picker
- Border radius slider
- Toggle options (logo, rating, reviews)
- Language selection (ru, en)
- Copy-to-clipboard for embed codes (script tag, iframe)
- Both JavaScript and iframe embed options

---

## Benchmark Components

**Location:** `frontend/src/components/benchmarks/`

### BenchmarkDashboard.tsx
**Purpose:** Competitor benchmarking dashboard widget
**Route:** `/dashboard/organization/benchmarks`
**Features:**
- Organization metrics vs category averages
- Percentile ranking visualization
- Trend indicators (up/down/stable)
- Period selector (7, 30, 90 days)
- Metric cards for rating, reviews, response rate
- AI-generated recommendations
- Loading and error states

**Metrics shown:**
- Average rating with category comparison
- Total reviews with percentile ranking
- Response rate (% of reviews with answers)
- Response time (if available)

---

## Marketing Components

**Location:** `frontend/src/components/marketing/`

### LayoutRenderer.tsx
**Purpose:** Renders marketing material layouts from JSON
**Block Types:**
- `logo` - Organization logo
- `text` - Text content with styling
- `qr` - QR code image
- `image` - Custom images
- `shape` - Decorative shapes
**Features:**
- Position and size management
- Theme support
- Paper size handling (A3, A4, A5)

---

## Component Patterns

### Form Components
```tsx
// Standard form pattern with React Hook Form + Zod
const form = useForm<FormSchema>({
  resolver: zodResolver(formSchema),
  defaultValues: {...}
});

<Form {...form}>
  <FormField
    control={form.control}
    name="fieldName"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Label</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</Form>
```

### Modal Dialog Pattern
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button onClick={handleSubmit}>Submit</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Card Pattern
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```
