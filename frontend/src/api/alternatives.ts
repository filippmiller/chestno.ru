// API functions for Better Alternatives recommendation engine

import { supabase } from '@/lib/supabaseClient'
import type {
  AlternativesRequest,
  AlternativesResponse,
  ProductAlternative,
  TransparencyScore,
  ABExperimentMetrics,
} from '@/types/alternatives'

/**
 * Fetches better alternatives for a product with low transparency score
 */
export async function getBetterAlternatives(
  request: AlternativesRequest
): Promise<AlternativesResponse> {
  const { productId, limit = 3, userId, sessionId, experimentId } = request

  // First check if we should even show alternatives
  const { data: scoreData } = await supabase
    .from('product_transparency_scores')
    .select('total_score')
    .eq('product_id', productId)
    .single()

  const sourceScore = scoreData?.total_score ?? null

  // Don't show alternatives for products with good transparency
  if (sourceScore !== null && sourceScore >= 60) {
    return {
      alternatives: [],
      sourceProductScore: sourceScore,
      showAlternatives: false,
    }
  }

  // Call the database function to get recommendations
  const { data, error } = await supabase.rpc('get_better_alternatives', {
    p_product_id: productId,
    p_limit: limit,
    p_user_id: userId || null,
    p_session_id: sessionId || null,
    p_experiment_id: experimentId || null,
  })

  if (error) {
    console.error('Error fetching alternatives:', error)
    return {
      alternatives: [],
      sourceProductScore: sourceScore,
      showAlternatives: false,
    }
  }

  // Transform database response to TypeScript types
  const alternatives: ProductAlternative[] = (data || []).map((row: Record<string, unknown>) => ({
    productId: row.product_id as string,
    name: row.name as string,
    slug: row.slug as string,
    imageUrl: row.image_url as string | null,
    priceCents: row.price_cents as number | null,
    currency: row.currency as string | null,
    category: row.category as string | null,
    transparencyScore: row.transparency_score as number,
    transparencyTier: row.transparency_tier as ProductAlternative['transparencyTier'],
    similarityScore: row.similarity_score as number,
    organizationName: row.organization_name as string,
    organizationSlug: row.organization_slug as string,
    organizationStatusLevel: row.organization_status_level as 'A' | 'B' | 'C' | null,
    isSponsored: row.is_sponsored as boolean,
    sponsoredId: row.sponsored_id as string | null,
    position: row.position as number,
  }))

  return {
    alternatives,
    sourceProductScore: sourceScore,
    showAlternatives: alternatives.length > 0,
  }
}

/**
 * Records an impression when alternatives are displayed
 */
export async function recordImpression(
  sourceProductId: string,
  alternative: ProductAlternative,
  sessionId: string | null,
  experimentId?: string | null,
  variant?: string | null
): Promise<string | null> {
  const { data, error } = await supabase.rpc('record_recommendation_impression', {
    p_source_product_id: sourceProductId,
    p_recommended_product_id: alternative.productId,
    p_position: alternative.position,
    p_is_sponsored: alternative.isSponsored,
    p_sponsored_id: alternative.sponsoredId,
    p_user_id: (await supabase.auth.getUser()).data.user?.id || null,
    p_session_id: sessionId,
    p_experiment_id: experimentId || null,
    p_variant: variant || null,
  })

  if (error) {
    console.error('Error recording impression:', error)
    return null
  }

  return data as string
}

/**
 * Records a click on a recommended alternative
 */
export async function recordClick(impressionId: string): Promise<void> {
  const { error } = await supabase.rpc('record_recommendation_click', {
    p_impression_id: impressionId,
  })

  if (error) {
    console.error('Error recording click:', error)
  }
}

/**
 * Fetches transparency score for a single product
 */
export async function getTransparencyScore(
  productId: string
): Promise<TransparencyScore | null> {
  const { data, error } = await supabase
    .from('product_transparency_scores')
    .select('*')
    .eq('product_id', productId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    productId: data.product_id,
    journeyCompletenessScore: data.journey_completeness_score,
    certificationScore: data.certification_score,
    claimVerificationScore: data.claim_verification_score,
    producerStatusScore: data.producer_status_score,
    reviewAuthenticityScore: data.review_authenticity_score,
    totalScore: data.total_score,
    transparencyTier: data.transparency_tier,
    lastCalculatedAt: data.last_calculated_at,
  }
}

/**
 * Triggers recalculation of transparency score
 */
export async function recalculateTransparencyScore(productId: string): Promise<void> {
  const { error } = await supabase.rpc('calculate_product_transparency_score', {
    p_product_id: productId,
  })

  if (error) {
    console.error('Error recalculating score:', error)
  }
}

/**
 * Gets A/B experiment metrics for analysis
 */
export async function getExperimentMetrics(
  experimentId: string
): Promise<ABExperimentMetrics[]> {
  const { data, error } = await supabase
    .from('recommendation_impressions')
    .select('variant, was_clicked, led_to_follow, led_to_purchase_intent')
    .eq('experiment_id', experimentId)

  if (error || !data) {
    return []
  }

  // Aggregate metrics by variant
  const variantMap = new Map<string, {
    impressions: number
    clicks: number
    follows: number
    purchaseIntents: number
  }>()

  for (const row of data) {
    const variant = row.variant || 'control'
    const existing = variantMap.get(variant) || {
      impressions: 0,
      clicks: 0,
      follows: 0,
      purchaseIntents: 0,
    }

    existing.impressions++
    if (row.was_clicked) existing.clicks++
    if (row.led_to_follow) existing.follows++
    if (row.led_to_purchase_intent) existing.purchaseIntents++

    variantMap.set(variant, existing)
  }

  return Array.from(variantMap.entries()).map(([variant, stats]) => ({
    experimentId,
    variant,
    impressions: stats.impressions,
    clicks: stats.clicks,
    clickThroughRate: stats.impressions > 0 ? stats.clicks / stats.impressions : 0,
    follows: stats.follows,
    followRate: stats.impressions > 0 ? stats.follows / stats.impressions : 0,
    purchaseIntents: stats.purchaseIntents,
    conversionRate: stats.impressions > 0 ? stats.purchaseIntents / stats.impressions : 0,
  }))
}

/**
 * Gets or creates a session ID for anonymous tracking
 */
export function getSessionId(): string {
  const key = 'chestno_session_id'
  let sessionId = sessionStorage.getItem(key)

  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem(key, sessionId)
  }

  return sessionId
}
