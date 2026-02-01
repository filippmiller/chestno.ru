/**
 * Scan Tier Badge Component
 *
 * Displays user's QR scanning tier as a visual badge.
 * Used in profiles, scan results, and leaderboards.
 */
import { Award, Star, Trophy, User } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { QrScanTier } from '@/types/qr-gamification'
import { QR_TIER_CONFIG } from '@/types/qr-gamification'

const TIER_ICONS = {
  none: User,
  bronze: Award,
  silver: Star,
  gold: Trophy,
} as const

interface ScanTierBadgeProps {
  tier: QrScanTier
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
  showTooltip?: boolean
  animate?: boolean
  className?: string
}

export function ScanTierBadge({
  tier,
  size = 'md',
  showLabel = false,
  showTooltip = true,
  animate = false,
  className = '',
}: ScanTierBadgeProps) {
  const config = QR_TIER_CONFIG[tier]
  const Icon = TIER_ICONS[tier]

  const sizeConfig = {
    sm: { icon: 'h-3 w-3', container: 'h-5 w-5', text: 'text-xs' },
    md: { icon: 'h-4 w-4', container: 'h-7 w-7', text: 'text-sm' },
    lg: { icon: 'h-6 w-6', container: 'h-10 w-10', text: 'text-base' },
    xl: { icon: 'h-8 w-8', container: 'h-14 w-14', text: 'text-lg' },
  }

  const sizes = sizeConfig[size]

  const badge = (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={{ color: config.color }}
    >
      <div
        className={`
          relative flex items-center justify-center rounded-full
          ${sizes.container}
          ${animate ? 'animate-pulse' : ''}
        `}
        style={{
          backgroundColor: `${config.color}15`,
          boxShadow: tier !== 'none' ? `0 0 12px ${config.color}40` : undefined,
        }}
      >
        {/* Glow ring for higher tiers */}
        {tier !== 'none' && (
          <div
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              background: `radial-gradient(circle, ${config.color}40 0%, transparent 70%)`,
            }}
          />
        )}
        <Icon className={`relative ${sizes.icon}`} strokeWidth={2.5} />
      </div>

      {showLabel && (
        <span className={`font-semibold ${sizes.text}`}>{config.name_ru}</span>
      )}
    </div>
  )

  if (!showTooltip || showLabel) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5">
            <p className="font-semibold" style={{ color: config.color }}>
              {config.name_ru}
            </p>
            <ul className="text-xs text-muted-foreground">
              {config.benefits_ru.map((benefit, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-primary">+</span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default ScanTierBadge
