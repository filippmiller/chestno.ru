/**
 * Rewards Section Component
 *
 * Displays available and claimed rewards.
 * Handles reward claiming with confirmation.
 */
import { useState } from 'react'
import {
  Award,
  Check,
  Clock,
  Download,
  ExternalLink,
  Gift,
  Lock,
  Sparkles,
  Tag,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type {
  QrReward,
  QrScanTier,
  RewardType,
  UserClaimedReward,
} from '@/types/qr-gamification'
import { QR_TIER_CONFIG, REWARD_TYPE_LABELS_RU } from '@/types/qr-gamification'
import { ScanTierBadge } from './ScanTierBadge'

const REWARD_ICONS: Record<RewardType, React.ElementType> = {
  discount_code: Tag,
  early_access: Sparkles,
  certification_pdf: Award,
  premium_feature: Zap,
  physical_badge: Gift,
  partner_offer: ExternalLink,
}

interface RewardsSectionProps {
  currentTier: QrScanTier
  currentPoints: number
  availableRewards: QrReward[]
  claimedRewards: UserClaimedReward[]
  onClaimReward: (reward: QrReward) => Promise<void>
  className?: string
}

export function RewardsSection({
  currentTier,
  currentPoints,
  availableRewards,
  claimedRewards,
  onClaimReward,
  className = '',
}: RewardsSectionProps) {
  const [selectedReward, setSelectedReward] = useState<QrReward | null>(null)
  const [claiming, setClaiming] = useState(false)

  // Create lookup for claimed rewards
  const claimedMap = new Map(claimedRewards.map((cr) => [cr.reward_id, cr]))

  // Separate available vs locked rewards
  const tierOrder: QrScanTier[] = ['none', 'bronze', 'silver', 'gold']
  const currentTierIndex = tierOrder.indexOf(currentTier)

  const canClaimReward = (reward: QrReward): boolean => {
    const requiredTierIndex = tierOrder.indexOf(reward.required_tier)
    return (
      currentTierIndex >= requiredTierIndex &&
      currentPoints >= reward.points_cost &&
      reward.is_available &&
      !claimedMap.has(reward.id)
    )
  }

  const handleClaim = async () => {
    if (!selectedReward) return

    setClaiming(true)
    try {
      await onClaimReward(selectedReward)
      setSelectedReward(null)
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Награды</h3>
          <p className="text-sm text-muted-foreground">
            Получайте награды за достижения
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Ваши очки</p>
          <p className="text-xl font-bold text-primary">{currentPoints}</p>
        </div>
      </div>

      {/* Available rewards */}
      {availableRewards.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-muted-foreground">Доступные награды</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {availableRewards.map((reward) => {
              const isClaimed = claimedMap.has(reward.id)
              const canClaim = canClaimReward(reward)
              const Icon = REWARD_ICONS[reward.reward_type]

              return (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  isClaimed={isClaimed}
                  canClaim={canClaim}
                  currentTier={currentTier}
                  Icon={Icon}
                  onClick={() => !isClaimed && setSelectedReward(reward)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Claimed rewards */}
      {claimedRewards.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-muted-foreground">Полученные награды</h4>
          <div className="divide-y rounded-lg border">
            {claimedRewards.map((claimed) => {
              const reward = claimed.reward
              if (!reward) return null
              const Icon = REWARD_ICONS[reward.reward_type]

              return (
                <div
                  key={claimed.id}
                  className="flex items-center gap-3 p-3"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${QR_TIER_CONFIG[reward.required_tier].color}20` }}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: QR_TIER_CONFIG[reward.required_tier].color }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{reward.name_ru}</p>
                    <p className="text-xs text-muted-foreground">
                      Получено {new Date(claimed.claimed_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>

                  {/* Action based on reward type */}
                  {reward.reward_type === 'certification_pdf' && (
                    <Button variant="outline" size="sm">
                      <Download className="mr-1 h-4 w-4" />
                      Скачать
                    </Button>
                  )}
                  {reward.reward_type === 'discount_code' &&
                    claimed.claim_data?.discount_code && (
                      <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                        {claimed.claim_data.discount_code as string}
                      </code>
                    )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {availableRewards.length === 0 && claimedRewards.length === 0 && (
        <div className="rounded-lg border bg-muted/30 py-12 text-center">
          <Gift className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">
            Пока нет доступных наград
          </p>
          <p className="text-sm text-muted-foreground">
            Продолжайте сканировать, чтобы открыть награды
          </p>
        </div>
      )}

      {/* Claim confirmation dialog */}
      <Dialog open={!!selectedReward} onOpenChange={() => setSelectedReward(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Получить награду</DialogTitle>
            <DialogDescription>
              Вы собираетесь получить эту награду
            </DialogDescription>
          </DialogHeader>

          {selectedReward && (
            <div className="py-4">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${QR_TIER_CONFIG[selectedReward.required_tier].color}20`,
                  }}
                >
                  {(() => {
                    const Icon = REWARD_ICONS[selectedReward.reward_type]
                    return (
                      <Icon
                        className="h-7 w-7"
                        style={{
                          color: QR_TIER_CONFIG[selectedReward.required_tier].color,
                        }}
                      />
                    )
                  })()}
                </div>
                <div>
                  <h4 className="font-semibold">{selectedReward.name_ru}</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedReward.description_ru}
                  </p>
                  {selectedReward.points_cost > 0 && (
                    <p className="mt-2 text-sm">
                      Стоимость:{' '}
                      <span className="font-semibold text-primary">
                        {selectedReward.points_cost} очков
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReward(null)}>
              Отмена
            </Button>
            <Button onClick={handleClaim} disabled={claiming}>
              {claiming ? 'Получение...' : 'Получить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface RewardCardProps {
  reward: QrReward
  isClaimed: boolean
  canClaim: boolean
  currentTier: QrScanTier
  Icon: React.ElementType
  onClick: () => void
}

function RewardCard({
  reward,
  isClaimed,
  canClaim,
  currentTier,
  Icon,
  onClick,
}: RewardCardProps) {
  const tierConfig = QR_TIER_CONFIG[reward.required_tier]
  const tierOrder: QrScanTier[] = ['none', 'bronze', 'silver', 'gold']
  const isLocked = tierOrder.indexOf(currentTier) < tierOrder.indexOf(reward.required_tier)

  return (
    <button
      onClick={onClick}
      disabled={isClaimed || !canClaim}
      className={`
        relative flex items-start gap-3 rounded-xl border p-4 text-left
        transition-all duration-200
        ${isClaimed ? 'bg-muted/50 opacity-60' : ''}
        ${canClaim && !isClaimed ? 'hover:border-primary hover:shadow-md cursor-pointer' : ''}
        ${isLocked ? 'opacity-50' : ''}
      `}
    >
      {/* Icon */}
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${tierConfig.color}20` }}
      >
        {isLocked ? (
          <Lock className="h-6 w-6 text-muted-foreground" />
        ) : (
          <Icon className="h-6 w-6" style={{ color: tierConfig.color }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium">{reward.name_ru}</h4>
          <ScanTierBadge tier={reward.required_tier} size="sm" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {reward.description_ru}
        </p>

        <div className="mt-2 flex items-center gap-3 text-xs">
          {reward.points_cost > 0 && (
            <span className="font-medium text-primary">
              {reward.points_cost} очков
            </span>
          )}
          {reward.points_cost === 0 && (
            <span className="text-green-600">Бесплатно</span>
          )}
          {reward.remaining !== null && (
            <span className="text-muted-foreground">
              Осталось: {reward.remaining}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      {isClaimed && (
        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}
    </button>
  )
}

export default RewardsSection
