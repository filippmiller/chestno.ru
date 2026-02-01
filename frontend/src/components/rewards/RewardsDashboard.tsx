/**
 * Rewards Dashboard Component
 *
 * Main dashboard for the "Баллы за отзывы" system showing:
 * - Points balance and stats
 * - Active vouchers
 * - Rate limit status
 * - Available rewards preview
 */
import { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Gift,
  Loader2,
  Sparkles,
  Star,
  Ticket,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getMyRewardsOverview } from '@/api/rewardsService'
import { TierBadge } from '@/components/loyalty/TierBadge'
import type { RewardItem, RewardRedemption, UserRewardsOverview } from '@/types/rewards'
import { REDEMPTION_STATUS_LABELS, getRewardValueDisplay } from '@/types/rewards'
import type { LoyaltyTier } from '@/types/loyalty'
import { TIER_CONFIG, TIER_THRESHOLDS } from '@/types/loyalty'

interface RewardsDashboardProps {
  className?: string
  onNavigateToRewards?: () => void
  tier?: LoyaltyTier
}

export function RewardsDashboard({
  className = '',
  onNavigateToRewards,
  tier = 'bronze',
}: RewardsDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<UserRewardsOverview | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    fetchOverview()
  }, [])

  const fetchOverview = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getMyRewardsOverview()
      setOverview(data)
    } catch (err) {
      setError('Не удалось загрузить данные')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const copyVoucherCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  if (loading) {
    return (
      <div className={`rounded-lg border bg-card p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !overview) {
    return (
      <div className={`rounded-lg border bg-card p-6 ${className}`}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchOverview}>
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  const tierConfig = TIER_CONFIG[tier]

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Points Summary Card */}
      <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <h2 className="text-lg font-semibold">Баллы за отзывы</h2>
            </div>
            <p className="mt-4 text-4xl font-bold text-primary">
              {overview.current_points.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              доступно баллов
            </p>
          </div>

          <div className="text-right">
            <TierBadge tier={tier} size="lg" showLabel />
            <p className="mt-2 text-sm text-muted-foreground">
              x{tierConfig.points_multiplier} множитель
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{overview.lifetime_points.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">всего заработано</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{overview.points_spent.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">использовано</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{overview.total_reviews}</p>
            <p className="text-xs text-muted-foreground">отзывов</p>
          </div>
        </div>
      </div>

      {/* Rate Limit Warning */}
      {!overview.rate_limit_status.allowed && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" />
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-200">
                {getRateLimitMessage(overview.rate_limit_status.reason)}
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                {overview.rate_limit_status.reason === 'daily_limit'
                  ? `Вы достигли дневного лимита (${overview.rate_limit_status.daily_limit} отзывов)`
                  : overview.rate_limit_status.reason === 'weekly_limit'
                    ? `Вы достигли недельного лимита (${overview.rate_limit_status.weekly_limit} отзывов)`
                    : overview.rate_limit_status.reason === 'account_too_new'
                      ? 'Аккаунт должен быть старше 3 дней'
                      : 'Временное ограничение активно'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Review Limits */}
      {overview.rate_limit_status.allowed && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-medium">Лимиты отзывов</h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Сегодня</span>
                <span>
                  {overview.rate_limit_status.daily_limit - (overview.rate_limit_status.daily_remaining || 0)}/
                  {overview.rate_limit_status.daily_limit}
                </span>
              </div>
              <Progress
                value={((overview.rate_limit_status.daily_limit - (overview.rate_limit_status.daily_remaining || 0)) / overview.rate_limit_status.daily_limit) * 100}
                className="h-2"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>За неделю</span>
                <span>
                  {overview.rate_limit_status.weekly_limit - (overview.rate_limit_status.weekly_remaining || 0)}/
                  {overview.rate_limit_status.weekly_limit}
                </span>
              </div>
              <Progress
                value={((overview.rate_limit_status.weekly_limit - (overview.rate_limit_status.weekly_remaining || 0)) / overview.rate_limit_status.weekly_limit) * 100}
                className="h-2"
              />
            </div>
          </div>
        </div>
      )}

      {/* Active Vouchers */}
      {overview.active_vouchers > 0 && overview.recent_redemptions.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="font-semibold">Активные промокоды</h3>
            <Badge variant="secondary">{overview.active_vouchers}</Badge>
          </div>
          <div className="divide-y">
            {overview.recent_redemptions
              .filter(r => r.status === 'active')
              .slice(0, 3)
              .map((redemption) => (
                <VoucherRow
                  key={redemption.id}
                  redemption={redemption}
                  copied={copiedCode === redemption.voucher_code}
                  onCopy={() => copyVoucherCode(redemption.voucher_code)}
                />
              ))}
          </div>
        </div>
      )}

      {/* Voucher Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4 text-center">
          <Ticket className="mx-auto h-6 w-6 text-green-500" />
          <p className="mt-2 text-2xl font-bold">{overview.active_vouchers}</p>
          <p className="text-xs text-muted-foreground">активных</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <CheckCircle className="mx-auto h-6 w-6 text-blue-500" />
          <p className="mt-2 text-2xl font-bold">{overview.used_vouchers}</p>
          <p className="text-xs text-muted-foreground">использовано</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <Clock className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-2xl font-bold">{overview.expired_vouchers}</p>
          <p className="text-xs text-muted-foreground">истекло</p>
        </div>
      </div>

      {/* Suggested Rewards */}
      {overview.suggested_rewards.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="font-semibold">Доступные награды</h3>
            {onNavigateToRewards && (
              <Button variant="ghost" size="sm" onClick={onNavigateToRewards}>
                Все награды
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {overview.suggested_rewards.map((reward) => (
              <SuggestedRewardCard key={reward.id} reward={reward} />
            ))}
          </div>
        </div>
      )}

      {/* Quality Score */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold">Качество отзывов</h3>
        </div>
        <div className="mt-3">
          <div className="mb-2 flex justify-between">
            <span className="text-sm text-muted-foreground">Средний балл качества</span>
            <span className="font-medium">{Math.round(overview.average_quality_score)}/100</span>
          </div>
          <Progress value={overview.average_quality_score} className="h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {overview.reviews_earning_points} из {overview.total_reviews} отзывов принесли баллы
          </p>
        </div>
      </div>

      {/* How to Earn */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <h3 className="mb-3 font-semibold">Как заработать больше баллов</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
            <span>Пишите подробные отзывы (от 200 слов) - до +50 баллов</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
            <span>Добавляйте фото (до 3 штук) - +15 баллов за каждое</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
            <span>Снимайте видео-обзоры - +30 баллов</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
            <span>Отзывы к покупкам получают бонус +20 баллов</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface VoucherRowProps {
  redemption: RewardRedemption
  copied: boolean
  onCopy: () => void
}

function VoucherRow({ redemption, copied, onCopy }: VoucherRowProps) {
  const daysLeft = Math.ceil(
    (new Date(redemption.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <p className="font-medium">{redemption.reward_title}</p>
        <p className="text-sm text-muted-foreground">{redemption.partner_name}</p>
        <p className="text-xs text-muted-foreground">
          {daysLeft > 0 ? `Истекает через ${daysLeft} дн.` : 'Истекает сегодня'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
          {redemption.voucher_code}
        </code>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onCopy}>
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {copied ? 'Скопировано!' : 'Копировать код'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}

interface SuggestedRewardCardProps {
  reward: RewardItem
}

function SuggestedRewardCard({ reward }: SuggestedRewardCardProps) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{reward.partner_name}</span>
      </div>
      <p className="mt-1 text-sm line-clamp-1">{reward.title}</p>
      <p className="mt-2 font-semibold text-primary">
        {reward.points_cost} баллов
      </p>
    </div>
  )
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getRateLimitMessage(reason?: string): string {
  switch (reason) {
    case 'daily_limit':
      return 'Дневной лимит отзывов достигнут'
    case 'weekly_limit':
      return 'Недельный лимит отзывов достигнут'
    case 'cooldown':
      return 'Временное ограничение'
    case 'flagged':
      return 'Аккаунт временно ограничен'
    case 'account_too_new':
      return 'Аккаунт слишком новый'
    default:
      return 'Ограничение активно'
  }
}

export default RewardsDashboard
