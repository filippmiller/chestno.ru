/**
 * ProfileSelector Component
 *
 * Allows users to select a preset trust preference profile or customize their own.
 * Used in onboarding and settings pages.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { TrustPreferenceProfile } from '@/types/trust-preferences'
import { useTrustPreferencesStore, selectCurrentProfile, selectFeaturedProfiles } from '@/store/trustPreferencesStore'

interface ProfileSelectorProps {
  showCustomOption?: boolean
  onSelect?: (profile: TrustPreferenceProfile | null) => void
  className?: string
  lang?: 'ru' | 'en'
}

export function ProfileSelector({
  showCustomOption = true,
  onSelect,
  className,
  lang = 'ru',
}: ProfileSelectorProps) {
  const profiles = useTrustPreferencesStore((state) => state.profiles)
  const featuredProfiles = useTrustPreferencesStore(selectFeaturedProfiles)
  const currentProfile = useTrustPreferencesStore(selectCurrentProfile)
  const selectProfile = useTrustPreferencesStore((state) => state.selectProfile)
  const setUseCustomWeights = useTrustPreferencesStore((state) => state.setUseCustomWeights)

  const [showAll, setShowAll] = useState(false)

  const displayProfiles = showAll ? profiles : featuredProfiles

  const handleSelect = (profile: TrustPreferenceProfile | null) => {
    selectProfile(profile)
    if (profile === null) {
      setUseCustomWeights(true)
    }
    onSelect?.(profile)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Profile grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayProfiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            isSelected={currentProfile?.id === profile.id}
            onSelect={() => handleSelect(profile)}
            lang={lang}
          />
        ))}

        {/* Custom option */}
        {showCustomOption && (
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 transition-all',
              currentProfile === null
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            )}
          >
            <div
              className={cn(
                'mb-2 flex h-12 w-12 items-center justify-center rounded-full',
                currentProfile === null ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'
              )}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className={cn(
              'font-medium',
              currentProfile === null ? 'text-indigo-700' : 'text-gray-600'
            )}>
              {lang === 'ru' ? 'Свой профиль' : 'Custom Profile'}
            </span>
            <span className="text-xs text-gray-500">
              {lang === 'ru' ? 'Настроить вручную' : 'Configure manually'}
            </span>
          </button>
        )}
      </div>

      {/* Show more/less */}
      {profiles.length > featuredProfiles.length && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          {showAll
            ? (lang === 'ru' ? 'Показать меньше' : 'Show less')
            : (lang === 'ru' ? `Показать все (${profiles.length})` : `Show all (${profiles.length})`)}
        </button>
      )}
    </div>
  )
}

// =============================================================================
// ProfileCard Component
// =============================================================================

interface ProfileCardProps {
  profile: TrustPreferenceProfile
  isSelected: boolean
  onSelect: () => void
  lang?: 'ru' | 'en'
}

export function ProfileCard({ profile, isSelected, onSelect, lang = 'ru' }: ProfileCardProps) {
  const name = lang === 'ru' ? profile.name_ru : profile.name_en
  const description = lang === 'ru' ? profile.description_ru : profile.description_en

  // Get top 3 factors from weights
  const topFactors = Object.entries(profile.weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code]) => code)

  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all',
        isSelected
          ? 'border-indigo-500 bg-indigo-50 shadow-md'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      )}
    >
      {/* Icon */}
      <div
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${profile.color}20` }}
      >
        <ProfileIcon icon={profile.icon} color={profile.color} />
      </div>

      {/* Name */}
      <h3 className={cn(
        'font-semibold',
        isSelected ? 'text-indigo-900' : 'text-gray-900'
      )}>
        {name}
      </h3>

      {/* Description */}
      {description && (
        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
          {description}
        </p>
      )}

      {/* Top factors */}
      <div className="mt-2 flex flex-wrap gap-1">
        {topFactors.map((factor) => (
          <span
            key={factor}
            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
          >
            {factor.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          {lang === 'ru' ? 'Выбран' : 'Selected'}
        </div>
      )}
    </button>
  )
}

// =============================================================================
// Profile Icon Helper
// =============================================================================

function ProfileIcon({ icon, color }: { icon?: string; color: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    scale: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    globe: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    leaf: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    'map-pin': (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    'badge-check': (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    heart: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    handshake: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
      </svg>
    ),
    star: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    eye: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  }

  return (
    <span style={{ color }}>
      {iconMap[icon || 'scale'] || iconMap.scale}
    </span>
  )
}
