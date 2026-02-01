// Types for Better Alternatives recommendation engine

export type TransparencyTier = 'excellent' | 'good' | 'fair' | 'low'

export interface TransparencyScore {
  productId: string
  journeyCompletenessScore: number
  certificationScore: number
  claimVerificationScore: number
  producerStatusScore: number
  reviewAuthenticityScore: number
  totalScore: number
  transparencyTier: TransparencyTier
  lastCalculatedAt: string
}

export interface ProductAlternative {
  productId: string
  name: string
  slug: string
  imageUrl: string | null
  priceCents: number | null
  currency: string | null
  category: string | null
  transparencyScore: number
  transparencyTier: TransparencyTier
  similarityScore: number
  organizationName: string
  organizationSlug: string
  organizationStatusLevel: 'A' | 'B' | 'C' | null
  isSponsored: boolean
  sponsoredId: string | null
  position: number
  // Client-side tracking
  impressionId?: string
}

export interface AlternativesRequest {
  productId: string
  limit?: number
  userId?: string | null
  sessionId?: string | null
  experimentId?: string | null
}

export interface AlternativesResponse {
  alternatives: ProductAlternative[]
  sourceProductScore: number | null
  showAlternatives: boolean
  experimentVariant?: string | null
}

export interface RecommendationImpression {
  id: string
  sourceProductId: string
  recommendedProductId: string
  position: number
  isSponsored: boolean
  sponsoredId: string | null
  userId: string | null
  sessionId: string | null
  experimentId: string | null
  variant: string | null
  wasClicked: boolean
  clickedAt: string | null
  ledToFollow: boolean
  ledToPurchaseIntent: boolean
  createdAt: string
}

// Sponsored alternatives configuration
export interface SponsoredAlternative {
  id: string
  productId: string
  organizationId: string
  campaignName: string
  priority: number
  budgetCents: number
  spentCents: number
  costPerImpressionCents: number
  costPerClickCents: number
  status: 'draft' | 'active' | 'paused' | 'depleted' | 'ended'
  startsAt: string
  endsAt: string | null
  targetCategory: string | null
  targetPriceMin: number | null
  targetPriceMax: number | null
  targetRegions: string[] | null
  minTransparencyScore: number
  createdAt: string
  updatedAt: string
}

// A/B Testing types
export interface ABExperiment {
  id: string
  name: string
  description: string | null
  variants: string[]
  trafficAllocation: Record<string, number>
  status: 'draft' | 'running' | 'paused' | 'completed'
  startedAt: string | null
  endsAt: string | null
  targetingRules: ABTargetingRules | null
  winnerVariant: string | null
  statisticalSignificance: number | null
  createdAt: string
  updatedAt: string
}

export interface ABTargetingRules {
  categories?: string[]
  regions?: string[]
  userSegments?: string[]
  minProductPrice?: number
  maxProductPrice?: number
}

export interface ABExperimentMetrics {
  experimentId: string
  variant: string
  impressions: number
  clicks: number
  clickThroughRate: number
  follows: number
  followRate: number
  purchaseIntents: number
  conversionRate: number
}

// Widget configuration
export interface AlternativesWidgetConfig {
  position: 'below-hero' | 'sidebar' | 'after-journey' | 'modal'
  maxAlternatives: number
  showOnlyIfLowScore: boolean
  lowScoreThreshold: number
  showSponsoredLabel: boolean
  showTransparencyComparison: boolean
  enableTracking: boolean
}

export const DEFAULT_WIDGET_CONFIG: AlternativesWidgetConfig = {
  position: 'below-hero',
  maxAlternatives: 3,
  showOnlyIfLowScore: true,
  lowScoreThreshold: 60,
  showSponsoredLabel: true,
  showTransparencyComparison: true,
  enableTracking: true,
}
