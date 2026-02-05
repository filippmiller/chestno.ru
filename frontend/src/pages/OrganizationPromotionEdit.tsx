import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Send, Users, AlertTriangle } from 'lucide-react'

import {
  createPromotion,
  getPromotion,
  updatePromotion,
  distributePromotion,
  getSubscriberCount,
} from '@/api/promotionsService'
import type {
  DiscountType,
  Platform,
  Promotion,
  PromotionCreatePayload,
  PromotionStatus,
  PromotionUpdatePayload,
} from '@/types/promotions'
import { DISCOUNT_TYPE_LABELS, PLATFORM_LABELS, PROMOTION_STATUS_LABELS } from '@/types/promotions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUserStore } from '@/store/userStore'

export function OrganizationPromotionEditPage() {
  const { promotionId } = useParams<{ promotionId: string }>()
  const navigate = useNavigate()
  const { selectedOrganizationId } = useUserStore()

  const isNew = !promotionId || promotionId === 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [subscriberCount, setSubscriberCount] = useState<number>(0)
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('percent')
  const [discountValue, setDiscountValue] = useState<string>('')
  const [discountDescription, setDiscountDescription] = useState('')
  const [minPurchase, setMinPurchase] = useState<string>('')
  const [platform, setPlatform] = useState<Platform>('own_website')
  const [platformName, setPlatformName] = useState('')
  const [platformUrl, setPlatformUrl] = useState('')
  const [codePrefix, setCodePrefix] = useState('PROMO')
  const [endsAt, setEndsAt] = useState('')
  const [status, setStatus] = useState<PromotionStatus>('draft')

  // Original promotion for comparison
  const [originalPromo, setOriginalPromo] = useState<Promotion | null>(null)

  // Notification options for distribution
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyInApp, setNotifyInApp] = useState(true)

  useEffect(() => {
    if (!selectedOrganizationId) return

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const subsResponse = await getSubscriberCount(selectedOrganizationId)
        setSubscriberCount(subsResponse.count)

        if (!isNew && promotionId) {
          const promo = await getPromotion(selectedOrganizationId, promotionId)
          setOriginalPromo(promo)
          setTitle(promo.title)
          setDescription(promo.description || '')
          setDiscountType(promo.discount_type)
          setDiscountValue(
            promo.discount_type === 'percent'
              ? promo.discount_value?.toString() || ''
              : promo.discount_value ? (promo.discount_value / 100).toString() : ''
          )
          setDiscountDescription(promo.discount_description || '')
          setMinPurchase(promo.min_purchase_amount ? (promo.min_purchase_amount / 100).toString() : '')
          setPlatform(promo.platform)
          setPlatformName(promo.platform_name || '')
          setPlatformUrl(promo.platform_url || '')
          setCodePrefix(promo.code_prefix)
          setEndsAt(promo.ends_at ? promo.ends_at.slice(0, 16) : '')
          setStatus(promo.status)
        }
      } catch (err) {
        console.error(err)
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedOrganizationId, promotionId, isNew])

  const handleSave = async () => {
    if (!selectedOrganizationId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const payload: PromotionCreatePayload | PromotionUpdatePayload = {
        title,
        description: description || undefined,
        discount_type: discountType,
        discount_value:
          discountType === 'percent'
            ? parseInt(discountValue) || undefined
            : discountValue ? Math.round(parseFloat(discountValue) * 100) : undefined,
        discount_description: discountDescription || undefined,
        min_purchase_amount: minPurchase ? Math.round(parseFloat(minPurchase) * 100) : undefined,
        platform,
        platform_name: platform === 'other' ? platformName : undefined,
        platform_url: platformUrl || undefined,
        code_prefix: codePrefix || 'PROMO',
        ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
      }

      if (isNew) {
        const created = await createPromotion(selectedOrganizationId, payload as PromotionCreatePayload)
        setSuccess('Промоакция создана!')
        navigate(`/dashboard/organization/promotions/${created.id}`)
      } else if (promotionId) {
        const updatePayload: PromotionUpdatePayload = { ...payload, status }
        await updatePromotion(selectedOrganizationId, promotionId, updatePayload)
        setSuccess('Изменения сохранены!')
      }
    } catch (err) {
      console.error(err)
      setError('Не удалось сохранить промоакцию')
    } finally {
      setSaving(false)
    }
  }

  const handleDistribute = async () => {
    if (!selectedOrganizationId || !promotionId || isNew) return

    setDistributing(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await distributePromotion(selectedOrganizationId, promotionId, {
        notify_email: notifyEmail,
        notify_in_app: notifyInApp,
      })
      setSuccess(`Коды разосланы ${result.codes_created} подписчикам!`)
      setDistributeDialogOpen(false)

      // Reload promotion to get updated stats
      const updated = await getPromotion(selectedOrganizationId, promotionId)
      setOriginalPromo(updated)
    } catch (err) {
      console.error(err)
      setError('Не удалось разослать коды')
    } finally {
      setDistributing(false)
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

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    )
  }

  const canDistribute = !isNew && status === 'active' && subscriberCount > 0

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/organization/promotions')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">
            {isNew ? 'Новая промоакция' : 'Редактирование промоакции'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isNew
              ? 'Создайте скидочный код для ваших подписчиков'
              : `Код: ${originalPromo?.code_prefix || codePrefix}-XXXX-XXXX`}
          </p>
        </div>
      </div>

      {/* Subscriber Count Banner */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <Users className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{subscriberCount}</p>
            <p className="text-sm text-muted-foreground">
              подписчиков получат эту акцию
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle>Основная информация</CardTitle>
          <CardDescription>Название и описание промоакции</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Название акции</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Скидка 10% на весь ассортимент"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Описание (необязательно)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Подробное описание условий акции..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Discount Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Скидка</CardTitle>
          <CardDescription>Тип и размер скидки</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discountType">Тип скидки</Label>
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DISCOUNT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {discountType === 'percent' && (
            <div className="space-y-2">
              <Label htmlFor="discountValue">Размер скидки (%)</Label>
              <Input
                id="discountValue"
                type="number"
                min="1"
                max="100"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="10"
              />
            </div>
          )}

          {discountType === 'fixed' && (
            <div className="space-y-2">
              <Label htmlFor="discountValue">Размер скидки (₽)</Label>
              <Input
                id="discountValue"
                type="number"
                min="1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="500"
              />
            </div>
          )}

          {discountType === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="discountDescription">Описание предложения</Label>
              <Input
                id="discountDescription"
                value={discountDescription}
                onChange={(e) => setDiscountDescription(e.target.value)}
                placeholder="Подарок при покупке от 3000₽"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="minPurchase">Минимальная сумма покупки (₽, необязательно)</Label>
            <Input
              id="minPurchase"
              type="number"
              min="0"
              value={minPurchase}
              onChange={(e) => setMinPurchase(e.target.value)}
              placeholder="1000"
            />
          </div>
        </CardContent>
      </Card>

      {/* Platform Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Площадка</CardTitle>
          <CardDescription>Где можно использовать промокод</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform">Площадка</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {platform === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="platformName">Название площадки</Label>
              <Input
                id="platformName"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                placeholder="Название вашей площадки"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="platformUrl">Ссылка на площадку (необязательно)</Label>
            <Input
              id="platformUrl"
              type="url"
              value={platformUrl}
              onChange={(e) => setPlatformUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Code Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Настройки кода</CardTitle>
          <CardDescription>Формат и срок действия</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="codePrefix">Префикс кода</Label>
            <Input
              id="codePrefix"
              value={codePrefix}
              onChange={(e) => setCodePrefix(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="PROMO"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Коды будут в формате: {codePrefix || 'PROMO'}-XXXX-XXXX
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endsAt">Действует до (необязательно)</Label>
            <Input
              id="endsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>

          {!isNew && (
            <div className="space-y-2">
              <Label htmlFor="status">Статус</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PromotionStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROMOTION_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => navigate('/dashboard/organization/promotions')}>
          Отмена
        </Button>
        <Button onClick={handleSave} disabled={saving || !title}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
        {canDistribute && (
          <Button onClick={() => setDistributeDialogOpen(true)} disabled={distributing}>
            <Send className="mr-2 h-4 w-4" />
            Разослать подписчикам
          </Button>
        )}
      </div>

      {/* Distribute Dialog */}
      <Dialog open={distributeDialogOpen} onOpenChange={setDistributeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Разослать промокоды?</DialogTitle>
            <DialogDescription>
              Уникальные промокоды будут созданы и отправлены {subscriberCount} подписчикам.
              Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notifyEmail">Отправить по email</Label>
              <Switch
                id="notifyEmail"
                checked={notifyEmail}
                onCheckedChange={setNotifyEmail}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notifyInApp">Уведомление на сайте</Label>
              <Switch
                id="notifyInApp"
                checked={notifyInApp}
                onCheckedChange={setNotifyInApp}
              />
            </div>

            {!notifyEmail && !notifyInApp && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Выберите хотя бы один способ уведомления
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDistributeDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleDistribute}
              disabled={distributing || (!notifyEmail && !notifyInApp)}
            >
              {distributing ? 'Отправка...' : `Отправить ${subscriberCount} подписчикам`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default OrganizationPromotionEditPage
