// Layout JSON structures

export type BlockType = 'logo' | 'text' | 'qr' | 'image' | 'shape'

export interface LayoutBlock {
  id: string
  type: BlockType
  binding?: string | null // e.g., business.name, business.qr.profile
  x: number
  y: number
  width?: number
  height?: number
  size?: number // For QR codes
  unit: string
  editable_by_business: boolean
  editable_by_support: boolean
  // Text-specific
  text?: string
  fontFamily?: string
  fontSizePt?: number
  fontWeight?: string
  align?: 'left' | 'center' | 'right'
  color?: string
  // QR-specific
  qr_url?: string
}

export interface LayoutPaper {
  size: 'A3' | 'A4' | 'A5'
  orientation: 'portrait' | 'landscape'
  width_mm: number
  height_mm: number
}

export interface LayoutTheme {
  background: string
  primaryColor: string
  accentColor: string
}

export interface LayoutJson {
  version: number
  paper: LayoutPaper
  theme: LayoutTheme
  blocks: LayoutBlock[]
}

// Marketing Templates (global blueprints)

export interface MarketingTemplate {
  id: string
  template_key: string
  name: string
  description?: string | null
  paper_size: 'A3' | 'A4' | 'A5'
  orientation: 'portrait' | 'landscape'
  layout_schema_version: number
  layout_json: LayoutJson
  thumbnail_url?: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MarketingTemplatesResponse {
  items: MarketingTemplate[]
  total: number
}

// Marketing Materials (business instances)

export interface MarketingMaterial {
  id: string
  business_id: string
  template_id?: string | null
  name: string
  paper_size: 'A3' | 'A4' | 'A5'
  orientation: 'portrait' | 'landscape'
  layout_schema_version: number
  layout_json: LayoutJson
  is_default_for_business: boolean
  support_notes?: string | null
  created_by_user_id?: string | null
  updated_by_user_id?: string | null
  created_at: string
  updated_at: string
}

export interface MarketingMaterialsResponse {
  items: MarketingMaterial[]
  total: number
}

export interface MarketingMaterialCreate {
  template_id: string
  name?: string
}

export interface MarketingMaterialUpdate {
  name?: string
  layout_json?: LayoutJson
}
