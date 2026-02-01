import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getBetterAlternatives,
  getTransparencyScore,
  recalculateTransparencyScore,
  getExperimentMetrics,
  getSessionId,
} from '@/api/alternatives'
import type { AlternativesRequest, AlternativesResponse, TransparencyScore, ABExperimentMetrics } from '@/types/alternatives'

// ============================================================
// Query Keys
// ============================================================

export const alternativesKeys = {
  all: ['alternatives'] as const,
  list: (productId: string) => [...alternativesKeys.all, 'list', productId] as const,
  score: (productId: string) => [...alternativesKeys.all, 'score', productId] as const,
  experiment: (experimentId: string) => [...alternativesKeys.all, 'experiment', experimentId] as const,
}

// ============================================================
// Hooks
// ============================================================

/**
 * Fetches better alternatives for a product
 */
export function useAlternatives(
  productId: string | undefined,
  options?: {
    limit?: number
    experimentId?: string | null
    enabled?: boolean
  }
) {
  const { limit = 3, experimentId, enabled = true } = options || {}

  return useQuery<AlternativesResponse>({
    queryKey: alternativesKeys.list(productId || ''),
    queryFn: async () => {
      if (!productId) {
        return { alternatives: [], sourceProductScore: null, showAlternatives: false }
      }

      const sessionId = getSessionId()
      return getBetterAlternatives({
        productId,
        limit,
        sessionId,
        experimentId,
      })
    },
    enabled: enabled && !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Fetches transparency score for a product
 */
export function useTransparencyScore(productId: string | undefined) {
  return useQuery<TransparencyScore | null>({
    queryKey: alternativesKeys.score(productId || ''),
    queryFn: async () => {
      if (!productId) return null
      return getTransparencyScore(productId)
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Mutation to recalculate transparency score
 */
export function useRecalculateScore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recalculateTransparencyScore,
    onSuccess: (_, productId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: alternativesKeys.score(productId) })
      queryClient.invalidateQueries({ queryKey: alternativesKeys.list(productId) })
    },
  })
}

/**
 * Fetches A/B experiment metrics
 */
export function useExperimentMetrics(experimentId: string | undefined) {
  return useQuery<ABExperimentMetrics[]>({
    queryKey: alternativesKeys.experiment(experimentId || ''),
    queryFn: async () => {
      if (!experimentId) return []
      return getExperimentMetrics(experimentId)
    },
    enabled: !!experimentId,
    staleTime: 60 * 1000, // 1 minute for real-time-ish metrics
  })
}

// ============================================================
// A/B Testing Hook
// ============================================================

interface ABTestConfig {
  experimentId: string
  variants: string[]
  defaultVariant?: string
}

interface ABTestResult {
  variant: string
  isLoading: boolean
  experimentId: string
}

/**
 * Hook for A/B testing - assigns user to a variant
 */
export function useABTest(config: ABTestConfig): ABTestResult {
  const { experimentId, variants, defaultVariant = 'control' } = config

  // Get or assign variant based on session
  const sessionId = getSessionId()

  // Simple hash-based assignment for consistency
  const hash = hashCode(sessionId + experimentId)
  const variantIndex = Math.abs(hash) % variants.length
  const variant = variants[variantIndex] || defaultVariant

  return {
    variant,
    isLoading: false,
    experimentId,
  }
}

// Simple hash function for consistent variant assignment
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

// ============================================================
// Utility Hooks
// ============================================================

/**
 * Hook to check if alternatives should be shown
 */
export function useShouldShowAlternatives(
  productId: string | undefined,
  threshold: number = 60
): { shouldShow: boolean; score: number | null; isLoading: boolean } {
  const { data: score, isLoading } = useTransparencyScore(productId)

  return {
    shouldShow: score !== null && score.totalScore < threshold,
    score: score?.totalScore ?? null,
    isLoading,
  }
}
