/**
 * Tier Progress Card Component
 *
 * Shows user's current tier, progress to next tier,
 * and key scanning statistics.
 */
import { ChevronRight, Flame, MapPin, Package, Scan } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import type { QrScannerProfile, QrScanTier } from '@/types/qr-gamification'
import { QR_TIER_CONFIG, getNextTier } from '@/types/qr-gamification'
import { ScanTierBadge } from './ScanTierBadge'

interface TierProgressCardProps {
  profile: QrScannerProfile
  className?: string
}

export function TierProgressCard({ profile, className = '' }: TierProgressCardProps) {
  const currentConfig = QR_TIER_CONFIG[profile.current_tier]
  const nextTier = getNextTier(profile.current_tier)
  const nextConfig = nextTier ? QR_TIER_CONFIG[nextTier] : null

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${className}`}>
      {/* Header with tier gradient */}
      <div
        className="relative px-6 py-8"
        style={{
          background: `linear-gradient(135deg, ${currentConfig.color}20 0%, ${currentConfig.color}05 100%)`,
        }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10"
          style={{ backgroundColor: currentConfig.color }}
        />
        <div
          className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10"
          style={{ backgroundColor: currentConfig.color }}
        />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ScanTierBadge tier={profile.current_tier} size="xl" animate />
            <div>
              <h2
                className="text-2xl font-bold"
                style={{ color: currentConfig.color }}
              >
                {currentConfig.name_ru}
              </h2>
              <p className="text-muted-foreground">
                {profile.total_scans} сканирований
              </p>
            </div>
          </div>

          {/* Monthly stats */}
          <div className="text-right">
            <p className="text-sm text-muted-foreground">В этом месяце</p>
            <p className="text-2xl font-bold">{profile.scans_this_month}</p>
          </div>
        </div>

        {/* Progress to next tier */}
        {nextTier && nextConfig && profile.scans_to_next_tier !== null && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">До</span>
                <ScanTierBadge tier={nextTier} size="sm" showLabel />
              </div>
              <span className="font-medium">
                {profile.scans_to_next_tier} сканирований
              </span>
            </div>
            <Progress
              value={profile.tier_progress_percent}
              className="h-2.5"
              style={
                {
                  '--progress-background': `${nextConfig.color}30`,
                  '--progress-foreground': nextConfig.color,
                } as React.CSSProperties
              }
            />
          </div>
        )}

        {/* Max tier message */}
        {!nextTier && (
          <div className="mt-6 rounded-lg bg-background/50 p-3 text-center">
            <p className="font-medium" style={{ color: currentConfig.color }}>
              Вы достигли максимального уровня!
            </p>
            <p className="text-sm text-muted-foreground">
              Продолжайте сканировать для рейтинга лидеров
            </p>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 divide-x border-t sm:grid-cols-4">
        <StatItem
          icon={<Scan className="h-4 w-4 text-blue-500" />}
          label="Всего"
          value={profile.total_scans}
        />
        <StatItem
          icon={<Package className="h-4 w-4 text-purple-500" />}
          label="Товаров"
          value={profile.unique_products_scanned}
        />
        <StatItem
          icon={<MapPin className="h-4 w-4 text-green-500" />}
          label="Компаний"
          value={profile.unique_organizations_scanned}
        />
        <StatItem
          icon={<Flame className="h-4 w-4 text-orange-500" />}
          label="Стрик"
          value={`${profile.current_streak_days} дн.`}
          highlight={profile.current_streak_days >= 3}
        />
      </div>
    </div>
  )
}

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: string | number
  highlight?: boolean
}

function StatItem({ icon, label, value, highlight }: StatItemProps) {
  return (
    <div className={`px-4 py-3 ${highlight ? 'bg-orange-500/5' : ''}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`mt-0.5 text-lg font-bold ${highlight ? 'text-orange-500' : ''}`}>
        {value}
      </p>
    </div>
  )
}

export default TierProgressCard
