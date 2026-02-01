/**
 * WeightSlider Component
 *
 * Slider control for adjusting individual trust factor weights.
 * Provides visual feedback and real-time updates.
 */

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { TrustFactor } from '@/types/trust-preferences'
import { TRUST_CATEGORY_CONFIG } from '@/types/trust-preferences'

interface WeightSliderProps {
  factor: TrustFactor
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  showDescription?: boolean
  lang?: 'ru' | 'en'
  className?: string
}

export function WeightSlider({
  factor,
  value,
  onChange,
  disabled = false,
  showDescription = false,
  lang = 'ru',
  className,
}: WeightSliderProps) {
  const [isDragging, setIsDragging] = useState(false)

  const name = lang === 'ru' ? factor.name_ru : factor.name_en
  const description = lang === 'ru' ? factor.description_ru : factor.description_en
  const categoryConfig = TRUST_CATEGORY_CONFIG[factor.category]

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10))
  }, [onChange])

  const getValueLabel = (val: number): string => {
    if (val === 0) return lang === 'ru' ? 'Не важно' : 'Not important'
    if (val < 25) return lang === 'ru' ? 'Низкий' : 'Low'
    if (val < 50) return lang === 'ru' ? 'Средний' : 'Medium'
    if (val < 75) return lang === 'ru' ? 'Высокий' : 'High'
    return lang === 'ru' ? 'Очень важно' : 'Very important'
  }

  const getGradientColor = (val: number): string => {
    if (val === 0) return '#9CA3AF'
    return factor.color
  }

  return (
    <div className={cn('group', disabled && 'opacity-50', className)}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Category dot */}
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: categoryConfig.color }}
          />
          {/* Factor name */}
          <span className={cn(
            'font-medium text-gray-900',
            value === 0 && 'text-gray-400'
          )}>
            {name}
          </span>
        </div>

        {/* Value badge */}
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
            value === 0
              ? 'bg-gray-100 text-gray-500'
              : 'text-white'
          )}
          style={{
            backgroundColor: value === 0 ? undefined : `${factor.color}`,
          }}
        >
          {value}%
        </span>
      </div>

      {/* Slider track */}
      <div className="relative">
        <input
          type="range"
          min={factor.min_weight}
          max={factor.max_weight}
          value={value}
          onChange={handleChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          disabled={disabled}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            disabled && 'cursor-not-allowed'
          )}
          style={{
            background: `linear-gradient(to right, ${getGradientColor(value)} 0%, ${getGradientColor(value)} ${value}%, #E5E7EB ${value}%, #E5E7EB 100%)`,
            // Custom thumb styling via CSS below
          }}
        />

        {/* Value label (shows on hover/drag) */}
        <div
          className={cn(
            'absolute -top-8 transform -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white transition-opacity',
            isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
          style={{ left: `${value}%` }}
        >
          {getValueLabel(value)}
        </div>
      </div>

      {/* Description */}
      {showDescription && description && (
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      )}

      {/* Quick actions */}
      <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {[0, 25, 50, 75, 100].map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            disabled={disabled}
            className={cn(
              'rounded px-2 py-0.5 text-xs transition-colors',
              value === preset
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Slider thumb styles (injected via style tag for custom appearance) */}
      <style>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${getGradientColor(value)};
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform 0.1s ease;
        }
        input[type='range']::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        input[type='range']::-webkit-slider-thumb:active {
          transform: scale(1.2);
        }
        input[type='range']::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${getGradientColor(value)};
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  )
}

// =============================================================================
// Grouped Sliders Component
// =============================================================================

interface WeightSliderGroupProps {
  factors: TrustFactor[]
  weights: Record<string, number>
  onWeightChange: (factorCode: string, value: number) => void
  showDescriptions?: boolean
  lang?: 'ru' | 'en'
  className?: string
}

export function WeightSliderGroup({
  factors,
  weights,
  onWeightChange,
  showDescriptions = false,
  lang = 'ru',
  className,
}: WeightSliderGroupProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {factors.map((factor) => (
        <WeightSlider
          key={factor.code}
          factor={factor}
          value={weights[factor.code] ?? factor.default_weight}
          onChange={(value) => onWeightChange(factor.code, value)}
          showDescription={showDescriptions}
          lang={lang}
        />
      ))}
    </div>
  )
}

// =============================================================================
// Compact toggle version (for quick filters)
// =============================================================================

interface WeightToggleProps {
  factor: TrustFactor
  isEnabled: boolean
  onToggle: () => void
  lang?: 'ru' | 'en'
  className?: string
}

export function WeightToggle({
  factor,
  isEnabled,
  onToggle,
  lang = 'ru',
  className,
}: WeightToggleProps) {
  const name = lang === 'ru' ? factor.name_ru : factor.name_en

  return (
    <button
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all',
        isEnabled
          ? 'text-white shadow-sm'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        className
      )}
      style={{
        backgroundColor: isEnabled ? factor.color : undefined,
      }}
    >
      {isEnabled && (
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {name}
    </button>
  )
}
