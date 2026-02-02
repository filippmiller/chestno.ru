// Supply Chain Visualization Types

export type SupplyChainNodeType =
  | 'PRODUCER'
  | 'PROCESSOR'
  | 'WAREHOUSE'
  | 'DISTRIBUTOR'
  | 'RETAILER'
  | 'CONSUMER'

export interface GeoCoordinates {
  lat: number
  lng: number
}

export interface SupplyChainNode {
  id: string
  organization_id: string
  product_id?: string | null
  node_type: SupplyChainNodeType
  name: string
  description?: string | null
  location?: string | null
  coordinates?: GeoCoordinates | null
  order_index: number
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  external_id?: string | null
  is_verified: boolean
  verified_at?: string | null
  image_url?: string | null
  certificate_urls: string[]
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface SupplyChainStep {
  id: string
  product_id: string
  from_node_id: string
  to_node_id: string
  description?: string | null
  transport_method?: string | null
  distance_km?: number | null
  duration_hours?: number | null
  timestamp?: string | null
  expected_arrival?: string | null
  verified: boolean
  verified_at?: string | null
  verification_notes?: string | null
  tracking_number?: string | null
  batch_id?: string | null
  temperature_celsius?: number | null
  humidity_percent?: number | null
  document_urls: string[]
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface SupplyChainJourneyNode {
  node: SupplyChainNode
  step_to_next?: SupplyChainStep | null
}

export interface SupplyChainJourney {
  product_id: string
  product_name: string
  product_slug: string
  organization_id: string
  organization_name: string
  nodes: SupplyChainJourneyNode[]
  total_nodes: number
  verified_nodes: number
  total_steps: number
  verified_steps: number
  total_distance_km: number
  total_duration_hours: number
}

export interface SupplyChainStats {
  total_nodes: number
  verified_nodes: number
  total_steps: number
  verified_steps: number
  total_distance_km: number
  total_duration_hours: number
  verification_percentage: number
}

// Create/Update DTOs
export interface SupplyChainNodeCreate {
  product_id?: string | null
  node_type: SupplyChainNodeType
  name: string
  description?: string | null
  location?: string | null
  coordinates?: GeoCoordinates | null
  order_index?: number | null
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  external_id?: string | null
  image_url?: string | null
  certificate_urls?: string[]
  metadata?: Record<string, unknown> | null
}

export interface SupplyChainNodeUpdate {
  node_type?: SupplyChainNodeType
  name?: string
  description?: string | null
  location?: string | null
  coordinates?: GeoCoordinates | null
  order_index?: number
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  external_id?: string | null
  image_url?: string | null
  certificate_urls?: string[]
  is_verified?: boolean
  metadata?: Record<string, unknown> | null
}

export interface SupplyChainStepCreate {
  from_node_id: string
  to_node_id: string
  description?: string | null
  transport_method?: string | null
  distance_km?: number | null
  duration_hours?: number | null
  timestamp?: string | null
  expected_arrival?: string | null
  tracking_number?: string | null
  batch_id?: string | null
  temperature_celsius?: number | null
  humidity_percent?: number | null
  document_urls?: string[]
  metadata?: Record<string, unknown> | null
}

export interface SupplyChainStepUpdate {
  description?: string | null
  transport_method?: string | null
  distance_km?: number | null
  duration_hours?: number | null
  timestamp?: string | null
  expected_arrival?: string | null
  verified?: boolean
  verification_notes?: string | null
  tracking_number?: string | null
  batch_id?: string | null
  temperature_celsius?: number | null
  humidity_percent?: number | null
  document_urls?: string[]
  metadata?: Record<string, unknown> | null
}

// Node type configuration for UI
export interface NodeTypeConfig {
  type: SupplyChainNodeType
  label: string
  icon: string
  color: string
  bgColor: string
}

export const NODE_TYPE_CONFIGS: Record<SupplyChainNodeType, NodeTypeConfig> = {
  PRODUCER: {
    type: 'PRODUCER',
    label: 'Производитель',
    icon: 'Leaf',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  PROCESSOR: {
    type: 'PROCESSOR',
    label: 'Переработка',
    icon: 'Factory',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  WAREHOUSE: {
    type: 'WAREHOUSE',
    label: 'Склад',
    icon: 'Warehouse',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  DISTRIBUTOR: {
    type: 'DISTRIBUTOR',
    label: 'Дистрибьютор',
    icon: 'Truck',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
  RETAILER: {
    type: 'RETAILER',
    label: 'Розница',
    icon: 'Store',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  CONSUMER: {
    type: 'CONSUMER',
    label: 'Потребитель',
    icon: 'User',
    color: 'text-pink-600',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
  },
}
