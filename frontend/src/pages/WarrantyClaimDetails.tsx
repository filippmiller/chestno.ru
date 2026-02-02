import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  ArrowLeft,
  Package,
  Building2,
  Calendar,
  Clock,
  User,
  MessageSquare,
  Image,
  CheckCircle2,
  AlertCircle,
  History,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import {
  WarrantyStatusBadge,
  ClaimStatusBadge,
  PriorityBadge,
} from '@/components/warranty'
import { getWarrantyDetails, getClaimHistory } from '@/api/warrantyService'
import type {
  WarrantyRegistrationWithProduct,
  WarrantyClaimHistoryEntry,
} from '@/types/warranty'
import {
  CLAIM_TYPE_LABELS,
  CLAIM_STATUS_LABELS,
  RESOLUTION_TYPE_LABELS,
} from '@/types/warranty'

export function WarrantyDetailsPage() {
  const { warrantyId } = useParams<{ warrantyId: string }>()
  const navigate = useNavigate()

  const [warranty, setWarranty] = useState<WarrantyRegistrationWithProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadWarranty = useCallback(async () => {
    if (!warrantyId) return

    setLoading(true)
    setError(null)

    try {
      const data = await getWarrantyDetails(warrantyId)
      setWarranty(data)
    } catch (err: any) {
      console.error('Failed to load warranty:', err)
      setError('Не удалось загрузить данные гарантии')
    } finally {
      setLoading(false)
    }
  }, [warrantyId])

  useEffect(() => {
    loadWarranty()
  }, [loadWarranty])

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: ru })
  }

  if (loading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32" />
          <div className="h-64 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    )
  }

  if (error || !warranty) {
    return (
      <div className="container max-w-2xl py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error || 'Гарантия не найдена'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-8">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад к гарантиям
      </Button>

      {/* Main Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start gap-4">
            {/* Product Image */}
            <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden flex-shrink-0">
              {warranty.product_image_url ? (
                <img
                  src={warranty.product_image_url}
                  alt={warranty.product_name || 'Товар'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <CardTitle className="text-xl">{warranty.product_name}</CardTitle>
              {warranty.organization_name && (
                <CardDescription className="flex items-center gap-1 mt-1">
                  <Building2 className="w-4 h-4" />
                  {warranty.organization_name}
                </CardDescription>
              )}
              <div className="mt-2">
                <WarrantyStatusBadge
                  status={warranty.status}
                  daysRemaining={warranty.days_remaining}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Warranty Validity Banner */}
          {warranty.is_valid ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">Гарантия действует</p>
                <p className="text-sm text-green-700">
                  Осталось {warranty.days_remaining} дней до окончания
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-gray-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-700">Гарантия недействительна</p>
                <p className="text-sm text-gray-600">
                  {warranty.status === 'expired'
                    ? 'Срок гарантии истек'
                    : `Статус: ${warranty.status}`}
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* Warranty Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Начало гарантии</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                {formatDate(warranty.warranty_start)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Окончание гарантии</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                {formatDate(warranty.warranty_end)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Purchase Info */}
          <div>
            <h3 className="font-medium mb-3">Информация о покупке</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Дата покупки:</span>
                <span>{formatDate(warranty.purchase_date)}</span>
              </div>
              {warranty.purchase_location && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Место покупки:</span>
                  <span>{warranty.purchase_location}</span>
                </div>
              )}
              {warranty.serial_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Серийный номер:</span>
                  <span className="font-mono">{warranty.serial_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Дата регистрации:</span>
                <span>{formatDate(warranty.registered_at)}</span>
              </div>
            </div>
          </div>

          {/* Coverage */}
          {warranty.coverage_description && (
            <>
              <Separator />
              <div>
                <h3 className="font-medium mb-2">Что покрывает гарантия</h3>
                <p className="text-sm text-muted-foreground">
                  {warranty.coverage_description}
                </p>
              </div>
            </>
          )}

          {/* Terms */}
          {warranty.warranty_terms && (
            <Accordion type="single" collapsible>
              <AccordionItem value="terms">
                <AccordionTrigger>Условия гарантии</AccordionTrigger>
                <AccordionContent>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {warranty.warranty_terms}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Actions */}
          {warranty.is_valid && (
            <>
              <Separator />
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => navigate(`/warranty/${warranty.id}/claim`)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Подать заявку
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact Info */}
      {(warranty.contact_email || warranty.contact_phone) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Контактные данные
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {warranty.contact_email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span>{warranty.contact_email}</span>
              </div>
            )}
            {warranty.contact_phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Телефон:</span>
                <span>{warranty.contact_phone}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default WarrantyDetailsPage
