/**
 * Rewards Catalog Component
 *
 * Displays available rewards from partner companies.
 * Users can browse, filter, and redeem rewards with their points.
 */
import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  ExternalLink,
  Filter,
  Gift,
  Loader2,
  ShoppingBag,
  Ticket,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getRewardsCatalog, redeemReward } from '@/api/rewardsService'
import type {
  PartnerCategory,
  RewardCatalogResponse,
  RewardItem,
  RewardRedemption,
} from '@/types/rewards'
import {
  getRewardValueDisplay,
  PARTNER_CATEGORY_LABELS,
  REWARD_TYPE_LABELS,
} from '@/types/rewards'

interface RewardsCatalogProps {
  userPoints?: number
  onPointsChange?: (newBalance: number) => void
  className?: string
}

export function RewardsCatalog({
  userPoints = 0,
  onPointsChange,
  className = '',
}: RewardsCatalogProps) {
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<RewardCatalogResponse | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<PartnerCategory | 'all'>('all')
  const [affordableOnly, setAffordableOnly] = useState(false)

  // Redemption state
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [redemptionResult, setRedemptionResult] = useState<{
    success: boolean
    voucher?: RewardRedemption
    error?: string
  } | null>(null)

  useEffect(() => {
    fetchCatalog()
  }, [selectedCategory, affordableOnly])

  const fetchCatalog = async () => {
    try {
      setLoading(true)
      const result = await getRewardsCatalog({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        affordableOnly,
      })
      setCatalog(result)
    } catch (error) {
      console.error('Failed to fetch catalog:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRedeem = async () => {
    if (!selectedReward) return

    try {
      setRedeeming(true)
      const result = await redeemReward(selectedReward.id)

      if (result.success && result.redemption) {
        setRedemptionResult({
          success: true,
          voucher: result.redemption,
        })
        onPointsChange?.(result.new_balance)
        // Refresh catalog to update availability
        fetchCatalog()
      } else {
        setRedemptionResult({
          success: false,
          error: result.error || 'Не удалось получить награду',
        })
      }
    } catch (error) {
      setRedemptionResult({
        success: false,
        error: 'Произошла ошибка при получении награды',
      })
    } finally {
      setRedeeming(false)
    }
  }

  const closeDialog = () => {
    setSelectedReward(null)
    setRedemptionResult(null)
  }

  if (loading && !catalog) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedCategory}
            onValueChange={(v) => setSelectedCategory(v as PartnerCategory | 'all')}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Все категории" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {catalog?.categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {PARTNER_CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={affordableOnly}
            onChange={(e) => setAffordableOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Только доступные мне</span>
        </label>

        <div className="ml-auto text-sm text-muted-foreground">
          Найдено: {catalog?.total || 0} наград
        </div>
      </div>

      {/* Rewards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog?.rewards.map((reward) => (
          <RewardCard
            key={reward.id}
            reward={reward}
            userPoints={userPoints}
            onSelect={() => setSelectedReward(reward)}
          />
        ))}
      </div>

      {catalog?.rewards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Gift className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">Награды не найдены</p>
          <p className="text-sm text-muted-foreground">
            Попробуйте изменить фильтры
          </p>
        </div>
      )}

      {/* Redemption Dialog */}
      <Dialog open={!!selectedReward} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          {!redemptionResult ? (
            <>
              <DialogHeader>
                <DialogTitle>Получить награду</DialogTitle>
                <DialogDescription>
                  Вы обмениваете баллы на промокод от {selectedReward?.partner_name}
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <div className="mb-4 flex items-start gap-4">
                  {selectedReward?.partner_logo_url ? (
                    <img
                      src={selectedReward.partner_logo_url}
                      alt={selectedReward.partner_name}
                      className="h-12 w-12 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                      <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">{selectedReward?.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedReward?.description}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-4">
                  <div className="flex justify-between">
                    <span>Стоимость:</span>
                    <span className="font-semibold">{selectedReward?.points_cost} баллов</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ваш баланс:</span>
                    <span className={userPoints >= (selectedReward?.points_cost || 0) ? 'text-green-600' : 'text-red-500'}>
                      {userPoints} баллов
                    </span>
                  </div>
                  <div className="mt-2 border-t pt-2">
                    <div className="flex justify-between">
                      <span>После получения:</span>
                      <span className="font-semibold">
                        {userPoints - (selectedReward?.points_cost || 0)} баллов
                      </span>
                    </div>
                  </div>
                </div>

                {selectedReward?.terms && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    {selectedReward.terms}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Отмена
                </Button>
                <Button
                  onClick={handleRedeem}
                  disabled={redeeming || !selectedReward?.user_can_redeem}
                >
                  {redeeming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Получаем...
                    </>
                  ) : (
                    <>
                      <Ticket className="mr-2 h-4 w-4" />
                      Получить промокод
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : redemptionResult.success ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  Награда получена!
                </DialogTitle>
              </DialogHeader>

              <div className="py-4">
                <div className="rounded-lg border-2 border-dashed border-green-500 bg-green-50 p-6 text-center dark:bg-green-950/20">
                  <p className="mb-2 text-sm text-muted-foreground">Ваш промокод:</p>
                  <p className="font-mono text-2xl font-bold tracking-wider">
                    {redemptionResult.voucher?.voucher_code}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Действует до {new Date(redemptionResult.voucher?.expires_at || '').toLocaleDateString('ru-RU')}
                  </p>
                </div>

                <div className="mt-4 rounded-lg bg-muted p-4 text-sm">
                  <p className="font-medium">Как использовать:</p>
                  <p className="text-muted-foreground">
                    Введите код при оформлении заказа на сайте {selectedReward?.partner_name}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={closeDialog}>
                  Готово
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Ошибка
                </DialogTitle>
              </DialogHeader>

              <div className="py-4">
                <p className="text-center text-muted-foreground">
                  {redemptionResult.error}
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Закрыть
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// REWARD CARD COMPONENT
// =============================================================================

interface RewardCardProps {
  reward: RewardItem
  userPoints: number
  onSelect: () => void
}

function RewardCard({ reward, userPoints, onSelect }: RewardCardProps) {
  const canAfford = userPoints >= reward.points_cost
  const isAvailable = reward.user_can_redeem || (!reward.user_can_afford && canAfford)

  return (
    <div
      className={`rounded-lg border bg-card transition-shadow hover:shadow-md ${
        !canAfford ? 'opacity-60' : ''
      }`}
    >
      {/* Partner Header */}
      <div className="flex items-center gap-3 border-b p-4">
        {reward.partner_logo_url ? (
          <img
            src={reward.partner_logo_url}
            alt={reward.partner_name}
            className="h-10 w-10 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div>
          <p className="font-medium">{reward.partner_name}</p>
          <Badge variant="secondary" className="text-xs">
            {REWARD_TYPE_LABELS[reward.reward_type]}
          </Badge>
        </div>
        <div className="ml-auto text-right">
          <span className="text-xl font-bold text-primary">
            {getRewardValueDisplay(reward)}
          </span>
        </div>
      </div>

      {/* Reward Content */}
      <div className="p-4">
        <h3 className="font-semibold">{reward.title}</h3>
        {reward.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {reward.description}
          </p>
        )}

        {/* Stock warning */}
        {reward.stock_remaining !== null && reward.stock_remaining <= 10 && (
          <p className="mt-2 text-xs text-orange-600">
            Осталось: {reward.stock_remaining} шт.
          </p>
        )}

        {/* User status */}
        {reward.user_redemptions_count > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Использовано: {reward.user_redemptions_count}/{reward.max_per_user}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t p-4">
        <div>
          <span className="text-lg font-bold">{reward.points_cost}</span>
          <span className="ml-1 text-sm text-muted-foreground">баллов</span>
        </div>
        <Button
          size="sm"
          disabled={!isAvailable}
          onClick={onSelect}
        >
          {canAfford ? (
            'Получить'
          ) : (
            `Нужно ${reward.points_cost - userPoints} баллов`
          )}
        </Button>
      </div>
    </div>
  )
}

export default RewardsCatalog
