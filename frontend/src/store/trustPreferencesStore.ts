import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type {
  TrustFactor,
  TrustPreferenceProfile,
  UserTrustPreferences,
  AnonymousTrustPreferences,
  TrustFactorGroup,
  TrustFactorCategory,
} from '@/types/trust-preferences'
import {
  getDefaultAnonymousPreferences,
  generateDeviceFingerprint,
  computePersonalizedScore,
} from '@/types/trust-preferences'

// =============================================================================
// Store State
// =============================================================================

interface TrustPreferencesState {
  // Reference data
  factors: TrustFactor[]
  factorGroups: TrustFactorGroup[]
  profiles: TrustPreferenceProfile[]

  // User preferences (synced with backend for authenticated users)
  userPreferences: UserTrustPreferences | null

  // Anonymous preferences (persisted to localStorage)
  anonymousPreferences: AnonymousTrustPreferences

  // UI state
  isLoading: boolean
  isOnboardingOpen: boolean
  onboardingStep: number

  // Computed
  effectiveWeights: Record<string, number>

  // Actions: Data loading
  setFactors: (factors: TrustFactor[]) => void
  setFactorGroups: (groups: TrustFactorGroup[]) => void
  setProfiles: (profiles: TrustPreferenceProfile[]) => void
  setUserPreferences: (prefs: UserTrustPreferences | null) => void
  setLoading: (loading: boolean) => void

  // Actions: Preference management
  selectProfile: (profile: TrustPreferenceProfile | null) => void
  updateWeight: (factorCode: string, weight: number) => void
  updateWeights: (weights: Record<string, number>) => void
  setUseCustomWeights: (useCustom: boolean) => void
  toggleFilter: (factorCode: string) => void
  setFilters: (filters: string[]) => void
  updateDisplaySettings: (settings: {
    show_trust_scores?: boolean
    highlight_matching?: boolean
    sort_by_trust_score?: boolean
    filter_threshold?: number
  }) => void

  // Actions: Onboarding
  openOnboarding: () => void
  closeOnboarding: () => void
  setOnboardingStep: (step: number) => void
  completeOnboarding: () => void
  skipOnboarding: () => void

  // Actions: Sync
  syncAnonymousToUser: (userId: string) => Promise<void>
  mergePreferencesOnLogin: (serverPrefs: UserTrustPreferences) => void
  resetPreferences: () => void

  // Computed getters
  getEffectiveWeights: () => Record<string, number>
  computeScore: (factorScores: Record<string, number>) => number
  getMatchingFactors: (factorScores: Record<string, number>) => string[]
}

// =============================================================================
// Helper: Compute effective weights
// =============================================================================

function computeEffectiveWeights(
  userPrefs: UserTrustPreferences | null,
  anonPrefs: AnonymousTrustPreferences,
  profiles: TrustPreferenceProfile[],
  factors: TrustFactor[]
): Record<string, number> {
  // If authenticated and has preferences
  if (userPrefs) {
    if (userPrefs.use_custom_weights && Object.keys(userPrefs.custom_weights).length > 0) {
      return userPrefs.custom_weights
    }
    if (userPrefs.profile_id) {
      const profile = profiles.find(p => p.id === userPrefs.profile_id)
      if (profile) return profile.weights
    }
  }

  // Anonymous preferences
  if (anonPrefs.use_custom_weights && Object.keys(anonPrefs.custom_weights).length > 0) {
    return anonPrefs.custom_weights
  }
  if (anonPrefs.profile_code) {
    const profile = profiles.find(p => p.code === anonPrefs.profile_code)
    if (profile) return profile.weights
  }

  // Default weights from factors
  const defaults: Record<string, number> = {}
  for (const factor of factors) {
    defaults[factor.code] = factor.default_weight
  }
  return defaults
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useTrustPreferencesStore = create<TrustPreferencesState>()(
  persist(
    (set, get) => ({
      // Initial state
      factors: [],
      factorGroups: [],
      profiles: [],
      userPreferences: null,
      anonymousPreferences: getDefaultAnonymousPreferences(),
      isLoading: false,
      isOnboardingOpen: false,
      onboardingStep: 0,
      effectiveWeights: {},

      // Data loading
      setFactors: (factors) => {
        const groups = groupFactorsByCategory(factors)
        set({
          factors,
          factorGroups: groups,
          effectiveWeights: computeEffectiveWeights(
            get().userPreferences,
            get().anonymousPreferences,
            get().profiles,
            factors
          ),
        })
      },

      setFactorGroups: (groups) => set({ factorGroups: groups }),

      setProfiles: (profiles) => {
        set({
          profiles,
          effectiveWeights: computeEffectiveWeights(
            get().userPreferences,
            get().anonymousPreferences,
            profiles,
            get().factors
          ),
        })
      },

      setUserPreferences: (prefs) => {
        set({
          userPreferences: prefs,
          effectiveWeights: computeEffectiveWeights(
            prefs,
            get().anonymousPreferences,
            get().profiles,
            get().factors
          ),
        })
      },

      setLoading: (loading) => set({ isLoading: loading }),

      // Profile selection
      selectProfile: (profile) => {
        const { userPreferences, anonymousPreferences } = get()

        if (userPreferences) {
          // For authenticated users, update server-synced prefs
          set({
            userPreferences: {
              ...userPreferences,
              profile_id: profile?.id,
              use_custom_weights: false,
              updated_at: new Date().toISOString(),
            },
          })
        } else {
          // For anonymous users, update localStorage prefs
          set({
            anonymousPreferences: {
              ...anonymousPreferences,
              profile_code: profile?.code,
              use_custom_weights: false,
              last_updated: new Date().toISOString(),
            },
          })
        }

        // Update effective weights
        set({
          effectiveWeights: computeEffectiveWeights(
            get().userPreferences,
            get().anonymousPreferences,
            get().profiles,
            get().factors
          ),
        })
      },

      // Weight updates
      updateWeight: (factorCode, weight) => {
        const { userPreferences, anonymousPreferences } = get()
        const newWeights = {
          ...(userPreferences?.custom_weights ?? anonymousPreferences.custom_weights),
          [factorCode]: weight,
        }

        if (userPreferences) {
          set({
            userPreferences: {
              ...userPreferences,
              custom_weights: newWeights,
              use_custom_weights: true,
              updated_at: new Date().toISOString(),
            },
            effectiveWeights: newWeights,
          })
        } else {
          set({
            anonymousPreferences: {
              ...anonymousPreferences,
              custom_weights: newWeights,
              use_custom_weights: true,
              last_updated: new Date().toISOString(),
            },
            effectiveWeights: newWeights,
          })
        }
      },

      updateWeights: (weights) => {
        const { userPreferences, anonymousPreferences } = get()

        if (userPreferences) {
          set({
            userPreferences: {
              ...userPreferences,
              custom_weights: weights,
              use_custom_weights: true,
              updated_at: new Date().toISOString(),
            },
            effectiveWeights: weights,
          })
        } else {
          set({
            anonymousPreferences: {
              ...anonymousPreferences,
              custom_weights: weights,
              use_custom_weights: true,
              last_updated: new Date().toISOString(),
            },
            effectiveWeights: weights,
          })
        }
      },

      setUseCustomWeights: (useCustom) => {
        const { userPreferences, anonymousPreferences, profiles, factors } = get()

        if (userPreferences) {
          const updated = {
            ...userPreferences,
            use_custom_weights: useCustom,
            updated_at: new Date().toISOString(),
          }
          set({
            userPreferences: updated,
            effectiveWeights: computeEffectiveWeights(updated, anonymousPreferences, profiles, factors),
          })
        } else {
          const updated = {
            ...anonymousPreferences,
            use_custom_weights: useCustom,
            last_updated: new Date().toISOString(),
          }
          set({
            anonymousPreferences: updated,
            effectiveWeights: computeEffectiveWeights(null, updated, profiles, factors),
          })
        }
      },

      // Filter management
      toggleFilter: (factorCode) => {
        const { userPreferences, anonymousPreferences } = get()
        const currentFilters = userPreferences?.active_filters ?? anonymousPreferences.active_filters

        const newFilters = currentFilters.includes(factorCode)
          ? currentFilters.filter(f => f !== factorCode)
          : [...currentFilters, factorCode]

        if (userPreferences) {
          set({
            userPreferences: {
              ...userPreferences,
              active_filters: newFilters,
              updated_at: new Date().toISOString(),
            },
          })
        } else {
          set({
            anonymousPreferences: {
              ...anonymousPreferences,
              active_filters: newFilters,
              last_updated: new Date().toISOString(),
            },
          })
        }
      },

      setFilters: (filters) => {
        const { userPreferences, anonymousPreferences } = get()

        if (userPreferences) {
          set({
            userPreferences: {
              ...userPreferences,
              active_filters: filters,
              updated_at: new Date().toISOString(),
            },
          })
        } else {
          set({
            anonymousPreferences: {
              ...anonymousPreferences,
              active_filters: filters,
              last_updated: new Date().toISOString(),
            },
          })
        }
      },

      updateDisplaySettings: (settings) => {
        const { userPreferences, anonymousPreferences } = get()

        if (userPreferences) {
          set({
            userPreferences: {
              ...userPreferences,
              ...settings,
              updated_at: new Date().toISOString(),
            },
          })
        } else {
          set({
            anonymousPreferences: {
              ...anonymousPreferences,
              ...settings,
              last_updated: new Date().toISOString(),
            },
          })
        }
      },

      // Onboarding
      openOnboarding: () => set({ isOnboardingOpen: true, onboardingStep: 0 }),
      closeOnboarding: () => set({ isOnboardingOpen: false }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),

      completeOnboarding: () => {
        const { userPreferences, anonymousPreferences } = get()

        if (userPreferences) {
          set({
            userPreferences: {
              ...userPreferences,
              onboarding_completed: true,
              updated_at: new Date().toISOString(),
            },
            isOnboardingOpen: false,
          })
        } else {
          set({
            anonymousPreferences: {
              ...anonymousPreferences,
              onboarding_completed: true,
              last_updated: new Date().toISOString(),
            },
            isOnboardingOpen: false,
          })
        }
      },

      skipOnboarding: () => {
        const { userPreferences, anonymousPreferences } = get()

        if (userPreferences) {
          set({
            userPreferences: {
              ...userPreferences,
              onboarding_skipped: true,
              updated_at: new Date().toISOString(),
            },
            isOnboardingOpen: false,
          })
        } else {
          set({
            anonymousPreferences: {
              ...anonymousPreferences,
              onboarding_skipped: true,
              last_updated: new Date().toISOString(),
            },
            isOnboardingOpen: false,
          })
        }
      },

      // Sync
      syncAnonymousToUser: async (userId) => {
        // This would call the API to merge anonymous preferences
        // Implementation depends on your API client
        const { anonymousPreferences } = get()
        console.log('Syncing anonymous preferences for user:', userId, anonymousPreferences)
        // After successful sync, the userPreferences will be set from API response
      },

      mergePreferencesOnLogin: (serverPrefs) => {
        const { anonymousPreferences } = get()

        // If user already completed onboarding on server, use server prefs
        if (serverPrefs.onboarding_completed) {
          set({
            userPreferences: serverPrefs,
            effectiveWeights: computeEffectiveWeights(
              serverPrefs,
              anonymousPreferences,
              get().profiles,
              get().factors
            ),
          })
          return
        }

        // Otherwise, prefer anonymous preferences if they exist
        if (anonymousPreferences.onboarding_completed || anonymousPreferences.use_custom_weights) {
          const mergedPrefs: UserTrustPreferences = {
            ...serverPrefs,
            custom_weights: anonymousPreferences.custom_weights,
            use_custom_weights: anonymousPreferences.use_custom_weights,
            active_filters: anonymousPreferences.active_filters,
            show_trust_scores: anonymousPreferences.show_trust_scores,
            highlight_matching: anonymousPreferences.highlight_matching,
            sort_by_trust_score: anonymousPreferences.sort_by_trust_score,
            filter_threshold: anonymousPreferences.filter_threshold,
            onboarding_completed: anonymousPreferences.onboarding_completed,
            onboarding_skipped: anonymousPreferences.onboarding_skipped,
          }
          set({
            userPreferences: mergedPrefs,
            effectiveWeights: computeEffectiveWeights(
              mergedPrefs,
              anonymousPreferences,
              get().profiles,
              get().factors
            ),
          })
          return
        }

        // Default to server preferences
        set({
          userPreferences: serverPrefs,
          effectiveWeights: computeEffectiveWeights(
            serverPrefs,
            anonymousPreferences,
            get().profiles,
            get().factors
          ),
        })
      },

      resetPreferences: () => {
        const defaultAnon = getDefaultAnonymousPreferences()
        set({
          userPreferences: null,
          anonymousPreferences: defaultAnon,
          effectiveWeights: computeEffectiveWeights(
            null,
            defaultAnon,
            get().profiles,
            get().factors
          ),
        })
      },

      // Computed
      getEffectiveWeights: () => get().effectiveWeights,

      computeScore: (factorScores) => {
        return computePersonalizedScore(factorScores, get().effectiveWeights)
      },

      getMatchingFactors: (factorScores) => {
        const weights = get().effectiveWeights
        const matches: string[] = []

        for (const [code, score] of Object.entries(factorScores)) {
          const weight = weights[code] ?? 0
          // Match if product scores >= 70 and user cares about it (weight >= 50)
          if (score >= 70 && weight >= 50) {
            matches.push(code)
          }
        }

        return matches
      },
    }),
    {
      name: 'chestno-trust-preferences',
      storage: createJSONStorage(() => localStorage),
      // Only persist anonymous preferences
      partialize: (state) => ({
        anonymousPreferences: state.anonymousPreferences,
      }),
    }
  )
)

// =============================================================================
// Helper: Group factors by category
// =============================================================================

function groupFactorsByCategory(factors: TrustFactor[]): TrustFactorGroup[] {
  const categoryLabels: Record<TrustFactorCategory, { ru: string; en: string }> = {
    ethical: { ru: 'Этика', en: 'Ethics' },
    quality: { ru: 'Качество', en: 'Quality' },
    origin: { ru: 'Происхождение', en: 'Origin' },
    environmental: { ru: 'Экология', en: 'Environmental' },
    health: { ru: 'Здоровье', en: 'Health' },
    social: { ru: 'Социальное', en: 'Social' },
    transparency: { ru: 'Прозрачность', en: 'Transparency' },
  }

  const grouped = new Map<TrustFactorCategory, TrustFactor[]>()

  for (const factor of factors) {
    if (!grouped.has(factor.category)) {
      grouped.set(factor.category, [])
    }
    grouped.get(factor.category)!.push(factor)
  }

  const groups: TrustFactorGroup[] = []
  const categoryOrder: TrustFactorCategory[] = [
    'ethical', 'quality', 'origin', 'environmental', 'health', 'social', 'transparency'
  ]

  for (const category of categoryOrder) {
    const categoryFactors = grouped.get(category)
    if (categoryFactors && categoryFactors.length > 0) {
      groups.push({
        category,
        label_ru: categoryLabels[category].ru,
        label_en: categoryLabels[category].en,
        factors: categoryFactors.sort((a, b) => a.display_order - b.display_order),
      })
    }
  }

  return groups
}

// =============================================================================
// Selectors
// =============================================================================

export const selectFactors = (state: TrustPreferencesState) => state.factors
export const selectProfiles = (state: TrustPreferencesState) => state.profiles
export const selectFeaturedProfiles = (state: TrustPreferencesState) =>
  state.profiles.filter(p => p.is_featured)
export const selectEffectiveWeights = (state: TrustPreferencesState) => state.effectiveWeights
export const selectActiveFilters = (state: TrustPreferencesState) =>
  state.userPreferences?.active_filters ?? state.anonymousPreferences.active_filters
export const selectShowTrustScores = (state: TrustPreferencesState) =>
  state.userPreferences?.show_trust_scores ?? state.anonymousPreferences.show_trust_scores
export const selectOnboardingCompleted = (state: TrustPreferencesState) =>
  state.userPreferences?.onboarding_completed ?? state.anonymousPreferences.onboarding_completed
export const selectCurrentProfile = (state: TrustPreferencesState) => {
  if (state.userPreferences?.profile_id) {
    return state.profiles.find(p => p.id === state.userPreferences!.profile_id)
  }
  if (state.anonymousPreferences.profile_code) {
    return state.profiles.find(p => p.code === state.anonymousPreferences.profile_code)
  }
  return null
}
