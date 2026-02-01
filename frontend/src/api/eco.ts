// API functions for Environmental Impact Scoring

import { supabase } from '@/lib/supabaseClient'
import type {
  ProductEcoData,
  ProductEcoDataInput,
  ProductEcoScore,
  EcoComparison,
  OrganizationEcoProfile,
  TransportModeScoring,
  PackagingMaterialScoring,
  ProductionEnergyScoring,
  TransportDistanceScoring,
} from '@/types/eco'

// =============================================================================
// Reference Data Queries
// =============================================================================

export async function getTransportModes(): Promise<TransportModeScoring[]> {
  const { data, error } = await supabase
    .from('transport_mode_scoring')
    .select('*')
    .order('score', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getTransportDistanceBrackets(): Promise<TransportDistanceScoring[]> {
  const { data, error } = await supabase
    .from('transport_distance_scoring')
    .select('*')
    .order('min_distance_km', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getPackagingMaterials(): Promise<PackagingMaterialScoring[]> {
  const { data, error } = await supabase
    .from('packaging_material_scoring')
    .select('*')
    .order('base_score', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getEnergySources(): Promise<ProductionEnergyScoring[]> {
  const { data, error } = await supabase
    .from('production_energy_scoring')
    .select('*')
    .order('score', { ascending: false })

  if (error) throw error
  return data || []
}

// =============================================================================
// Product Eco Data CRUD
// =============================================================================

export async function getProductEcoData(productId: string): Promise<ProductEcoData | null> {
  const { data, error } = await supabase
    .from('product_eco_data')
    .select('*')
    .eq('product_id', productId)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
  return data
}

export async function upsertProductEcoData(
  productId: string,
  ecoData: ProductEcoDataInput
): Promise<ProductEcoData> {
  const { data, error } = await supabase
    .from('product_eco_data')
    .upsert({
      product_id: productId,
      ...ecoData,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'product_id',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteProductEcoData(productId: string): Promise<void> {
  const { error } = await supabase
    .from('product_eco_data')
    .delete()
    .eq('product_id', productId)

  if (error) throw error
}

// =============================================================================
// Product Eco Score Queries
// =============================================================================

export async function getProductEcoScore(productId: string): Promise<ProductEcoScore | null> {
  const { data, error } = await supabase
    .from('product_eco_scores')
    .select('*')
    .eq('product_id', productId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getEcoComparison(productId: string): Promise<EcoComparison | null> {
  const { data, error } = await supabase
    .rpc('get_eco_comparison', { p_product_id: productId })
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function recalculateEcoScore(productId: string): Promise<ProductEcoScore> {
  const { data, error } = await supabase
    .rpc('calculate_product_eco_score', { p_product_id: productId })
    .single()

  if (error) throw error
  return data
}

// =============================================================================
// Organization Eco Profile
// =============================================================================

export async function getOrganizationEcoProfile(
  organizationId: string
): Promise<OrganizationEcoProfile | null> {
  const { data, error } = await supabase
    .from('organization_eco_profile')
    .select('*')
    .eq('organization_id', organizationId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function upsertOrganizationEcoProfile(
  organizationId: string,
  profile: Partial<OrganizationEcoProfile>
): Promise<OrganizationEcoProfile> {
  const { data, error } = await supabase
    .from('organization_eco_profile')
    .upsert({
      organization_id: organizationId,
      ...profile,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// =============================================================================
// Batch & Aggregate Queries
// =============================================================================

export async function getProductsWithEcoScores(
  organizationId: string,
  options?: {
    limit?: number
    offset?: number
    minScore?: number
    maxScore?: number
    grade?: string
  }
): Promise<{
  products: Array<{
    id: string
    name: string
    slug: string
    main_image_url?: string | null
    eco_score?: ProductEcoScore | null
  }>
  total: number
}> {
  let query = supabase
    .from('products')
    .select(`
      id,
      name,
      slug,
      main_image_url,
      eco_score:product_eco_scores(*)
    `, { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'published')

  if (options?.minScore !== undefined) {
    query = query.gte('product_eco_scores.total_score', options.minScore)
  }

  if (options?.maxScore !== undefined) {
    query = query.lte('product_eco_scores.total_score', options.maxScore)
  }

  if (options?.grade) {
    query = query.eq('product_eco_scores.eco_grade', options.grade)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    products: data?.map(p => ({
      ...p,
      eco_score: Array.isArray(p.eco_score) ? p.eco_score[0] : p.eco_score,
    })) || [],
    total: count || 0,
  }
}

export async function getTopEcoProducts(
  limit: number = 10,
  category?: string
): Promise<Array<{
  id: string
  name: string
  slug: string
  main_image_url?: string | null
  organization_name: string
  eco_grade: string
  total_score: number
  co2_reduction_percentage?: number | null
}>> {
  let query = supabase
    .from('product_eco_scores')
    .select(`
      product_id,
      eco_grade,
      total_score,
      co2_vs_import_percentage,
      product:products!inner(
        id,
        name,
        slug,
        main_image_url,
        category,
        organization:organizations(name)
      )
    `)
    .not('total_score', 'is', null)
    .order('total_score', { ascending: false })
    .limit(limit)

  if (category) {
    query = query.eq('products.category', category)
  }

  const { data, error } = await query

  if (error) throw error

  return data?.map(item => ({
    id: (item.product as any)?.id,
    name: (item.product as any)?.name,
    slug: (item.product as any)?.slug,
    main_image_url: (item.product as any)?.main_image_url,
    organization_name: (item.product as any)?.organization?.name || '',
    eco_grade: item.eco_grade || 'F',
    total_score: item.total_score || 0,
    co2_reduction_percentage: item.co2_vs_import_percentage,
  })) || []
}

// =============================================================================
// Utility Functions
// =============================================================================

export function calculateDistanceScore(distanceKm: number, brackets: TransportDistanceScoring[]): {
  score: number
  bracket: TransportDistanceScoring | null
} {
  const bracket = brackets.find(
    b => distanceKm >= b.min_distance_km &&
      (b.max_distance_km === null || distanceKm <= b.max_distance_km)
  )

  return {
    score: bracket?.score || 0,
    bracket: bracket || null,
  }
}

export function estimateCO2(
  distanceKm: number,
  transportMode: TransportModeScoring | null,
  bracket: TransportDistanceScoring | null
): number {
  if (!bracket) return 0

  const baseCO2 = distanceKm * bracket.co2_kg_per_km
  const modeMultiplier = transportMode?.co2_multiplier || 1.0

  return baseCO2 * modeMultiplier
}
