import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Edit,
  Trash2,
  Send,
  Users,
  Gift,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
} from 'lucide-react'

import { listPromotions, deletePromotion, getSubscriberCount } from '@/api/promotionsService'
import type { Promotion, PromotionStatus } from '@/types/promotions'
import { PROMOTION_STATUS_LABELS, PLATFORM_LABELS } from '@/types/promotions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUserStore } from '@/store/userStore'

const STATUS_ICONS: Record<PromotionStatus, React.ReactNode> = {
  draft: <Clock className="h-4 w-4" />,
  active: <CheckCircle2 className="h-4 w-4" />,
  paused: <Pause className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
}

const STATUS_VARIANTS: Record<PromotionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  active: 'default',
  paused: 'outline',
  completed: 'secondary',
  cancelled: 'destructive',
}

export function OrganizationPromotionsPage() {
  const { selectedOrganizationId } = useUserStore()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [subscriberCount, setSubscriberCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null)

  const loadData = async () => {
    if (!selectedOrganizationId) return

    setLoading(true)
    setError(null)
    try {
      const [promosResponse, subsResponse] = await Promise.all([
        listPromotions(selectedOrganizationId, { limit: 50 }),
        getSubscriberCount(selectedOrganizationId),
      ])
      setPromotions(promosResponse.items)
      setSubscriberCount(subsResponse.count)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить промоакции')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrganizationId])

  const handleDelete = async () => {
    if (!selectedOrganizationId || !promotionToDelete) return

    try {
      await deletePromotion(selectedOrganizationId, promotionToDelete.id)
      setPromotions((prev) => prev.filter((p) => p.id !== promotionToDelete.id))
      setDeleteDialogOpen(false)
      setPromotionToDelete(null)
    } catch (err) {
      console.error(err)
      setError('Не удалось удалить промоакцию')
    }
  }

  if (!selectedOrganizationId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <Alert>
          <AlertDescription>Выберите организацию</AlertDescription>
        </Alert>
      </div>
    )
  }

  const activePromos = promotions.filter((p) => p.status === 'active')
  const totalCodesGenerated = promotions.reduce((sum, p) => sum + p.total_codes_generated, 0)
  const totalCodesUsed = promotions.reduce((sum, p) => sum + p.total_codes_used, 0)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Промокоды для подписчиков</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Создавайте эксклюзивные скидки для ваших подписчиков
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto min-h-[44px]">
          <Link to="/dashboard/organization/promotions/new">
            <Plus className="mr-2 h-4 w-4" />
            Создать промоакцию
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Подписчики</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriberCount}</div>
            <p className="text-xs text-muted-foreground">активных подписчиков</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные акции</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePromos.length}</div>
            <p className="text-xs text-muted-foreground">из {promotions.length} всего</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Выдано кодов</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCodesGenerated}</div>
            <p className="text-xs text-muted-foreground">всего отправлено</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Использовано</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCodesUsed}</div>
            <p className="text-xs text-muted-foreground">
              {totalCodesGenerated > 0
                ? `${Math.round((totalCodesUsed / totalCodesGenerated) * 100)}% конверсия`
                : 'нет данных'}
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Promotions List */}
      {loading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Gift className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              Пока нет промоакций. Создайте первую акцию для ваших подписчиков!
            </p>
            <Button asChild className="mt-4">
              <Link to="/dashboard/organization/promotions/new">
                <Plus className="mr-2 h-4 w-4" />
                Создать промоакцию
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {promotions.map((promo) => (
            <Card key={promo.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {promo.title}
                      <Badge variant={STATUS_VARIANTS[promo.status]}>
                        {STATUS_ICONS[promo.status]}
                        <span className="ml-1">{PROMOTION_STATUS_LABELS[promo.status]}</span>
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {promo.discount_display} • {PLATFORM_LABELS[promo.platform]}
                      {promo.platform_name && ` (${promo.platform_name})`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" asChild>
                      <Link to={`/dashboard/organization/promotions/${promo.id}`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setPromotionToDelete(promo)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Выдано кодов: </span>
                    <span className="font-medium">{promo.total_codes_generated}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Использовано: </span>
                    <span className="font-medium">{promo.total_codes_used}</span>
                  </div>
                  {promo.ends_at && (
                    <div>
                      <span className="text-muted-foreground">Действует до: </span>
                      <span className="font-medium">
                        {new Date(promo.ends_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  )}
                  {promo.distributed_at && (
                    <div>
                      <span className="text-muted-foreground">Отправлено: </span>
                      <span className="font-medium">
                        {new Date(promo.distributed_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить промоакцию?</DialogTitle>
            <DialogDescription>
              {promotionToDelete?.total_codes_generated
                ? 'Эта акция уже разослала коды подписчикам. Она будет отмечена как отменённая.'
                : 'Акция будет полностью удалена. Это действие нельзя отменить.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default OrganizationPromotionsPage
