import { useEffect, useState } from 'react'
import {
  Gift,
  Copy,
  Check,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Tag,
  Store,
  Filter,
} from 'lucide-react'

import { listMyPromoCodes, markCodeViewed, markCodeUsed } from '@/api/promotionsService'
import type { PromoCode, PromoCodeStatus } from '@/types/promotions'
import { PROMO_CODE_STATUS_LABELS, PLATFORM_LABELS } from '@/types/promotions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const STATUS_ICONS: Record<PromoCodeStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  active: <Gift className="h-4 w-4" />,
  used: <CheckCircle2 className="h-4 w-4" />,
  expired: <XCircle className="h-4 w-4" />,
}

const STATUS_VARIANTS: Record<PromoCodeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  active: 'default',
  used: 'secondary',
  expired: 'destructive',
}

export function MyPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedCode, setSelectedCode] = useState<PromoCode | null>(null)
  const [useDialogOpen, setUseDialogOpen] = useState(false)
  const [markingUsed, setMarkingUsed] = useState(false)
  const [activeTab, setActiveTab] = useState<'active' | 'used' | 'all'>('active')

  const loadCodes = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await listMyPromoCodes({ limit: 100 })
      setCodes(response.items)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить промокоды')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCodes()
  }, [])

  const handleCopyCode = async (code: PromoCode) => {
    try {
      await navigator.clipboard.writeText(code.code)
      setCopiedId(code.id)
      setTimeout(() => setCopiedId(null), 2000)

      // Mark as viewed if not already
      if (!code.viewed_at) {
        await markCodeViewed(code.id)
        setCodes((prev) =>
          prev.map((c) =>
            c.id === code.id ? { ...c, viewed_at: new Date().toISOString() } : c
          )
        )
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleMarkUsed = async () => {
    if (!selectedCode) return

    setMarkingUsed(true)
    try {
      await markCodeUsed(selectedCode.id)
      setCodes((prev) =>
        prev.map((c) =>
          c.id === selectedCode.id
            ? { ...c, status: 'used', used_at: new Date().toISOString() }
            : c
        )
      )
      setUseDialogOpen(false)
      setSelectedCode(null)
    } catch (err) {
      console.error(err)
      setError('Не удалось отметить код как использованный')
    } finally {
      setMarkingUsed(false)
    }
  }

  const filteredCodes = codes.filter((code) => {
    if (activeTab === 'active') return code.status === 'active'
    if (activeTab === 'used') return code.status === 'used'
    return true
  })

  const activeCodes = codes.filter((c) => c.status === 'active')
  const usedCodes = codes.filter((c) => c.status === 'used')

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Мои промокоды</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Эксклюзивные скидки от производителей, на которых вы подписаны
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего кодов</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{codes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активных</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCodes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Использовано</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usedCodes.length}</div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="active">
            Активные ({activeCodes.length})
          </TabsTrigger>
          <TabsTrigger value="used">
            Использованные ({usedCodes.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            Все ({codes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Загрузка...</p>
          ) : filteredCodes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Gift className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {activeTab === 'active'
                    ? 'Нет активных промокодов. Подпишитесь на производителей, чтобы получать эксклюзивные скидки!'
                    : activeTab === 'used'
                    ? 'Вы ещё не использовали ни одного промокода'
                    : 'У вас пока нет промокодов'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredCodes.map((code) => (
                <Card key={code.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {code.organization_logo ? (
                          <img
                            src={code.organization_logo}
                            alt={code.organization_name || ''}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <Store className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-lg">
                            {code.promotion_title || 'Промоакция'}
                          </CardTitle>
                          <CardDescription>
                            {code.organization_name || 'Производитель'}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANTS[code.status]}>
                        {STATUS_ICONS[code.status]}
                        <span className="ml-1">{PROMO_CODE_STATUS_LABELS[code.status]}</span>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Discount info */}
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-lg font-semibold">{code.discount_display}</p>
                      <p className="text-sm text-muted-foreground">
                        {code.platform_name || PLATFORM_LABELS[code.platform!]}
                      </p>
                    </div>

                    {/* Promo code */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-md border bg-background p-3 font-mono text-lg font-bold tracking-wider">
                        {code.code}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyCode(code)}
                        disabled={code.status !== 'active'}
                      >
                        {copiedId === code.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {code.platform_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={code.platform_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Перейти на площадку
                          </a>
                        </Button>
                      )}
                      {code.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCode(code)
                            setUseDialogOpen(true)
                          }}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Отметить как использованный
                        </Button>
                      )}
                    </div>

                    {/* Expiration */}
                    {code.expires_at && (
                      <p className="text-xs text-muted-foreground">
                        Действует до: {new Date(code.expires_at).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mark as Used Dialog */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отметить код как использованный?</DialogTitle>
            <DialogDescription>
              Это поможет нам улучшить предложения для вас.
              Код: <strong>{selectedCode?.code}</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleMarkUsed} disabled={markingUsed}>
              {markingUsed ? 'Сохранение...' : 'Подтвердить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MyPromoCodesPage
