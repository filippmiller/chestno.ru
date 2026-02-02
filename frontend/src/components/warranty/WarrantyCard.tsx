import { Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  Package,
  Building2,
  FileText,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'

import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WarrantyStatusBadge } from './WarrantyStatusBadge'
import type { WarrantyRegistrationWithProduct } from '@/types/warranty'

interface WarrantyCardProps {
  warranty: WarrantyRegistrationWithProduct
  showActions?: boolean
  onViewDetails?: (id: string) => void
  onSubmitClaim?: (id: string) => void
}

export function WarrantyCard({
  warranty,
  showActions = true,
  onViewDetails,
  onSubmitClaim,
}: WarrantyCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const isExpiringSoon =
    warranty.status === 'active' &&
    warranty.days_remaining !== undefined &&
    warranty.days_remaining <= 30

  const canSubmitClaim =
    warranty.is_valid && warranty.status === 'active'

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex">
          {/* Product Image */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 bg-muted">
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

          {/* Content */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">
                  {warranty.product_name || 'Без названия'}
                </h3>
                {warranty.organization_name && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3" />
                    {warranty.organization_name}
                  </p>
                )}
              </div>
              <WarrantyStatusBadge
                status={warranty.status}
                daysRemaining={warranty.days_remaining}
              />
            </div>

            {/* Warranty Period */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Куплено: {formatDate(warranty.purchase_date)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>До: {formatDate(warranty.warranty_end)}</span>
              </div>
            </div>

            {/* Warning if expiring soon */}
            {isExpiringSoon && (
              <div className="mt-2 flex items-center gap-1.5 text-orange-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  {warranty.days_remaining === 0
                    ? 'Гарантия истекает сегодня!'
                    : `Гарантия истекает через ${warranty.days_remaining} дн.`}
                </span>
              </div>
            )}

            {/* Serial Number if available */}
            {warranty.serial_number && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>S/N: {warranty.serial_number}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {showActions && (
        <CardFooter className="border-t bg-muted/30 p-3 flex gap-2">
          {onViewDetails && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onViewDetails(warranty.id)}
            >
              Подробнее
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {canSubmitClaim && onSubmitClaim && (
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={() => onSubmitClaim(warranty.id)}
            >
              Подать заявку
            </Button>
          )}
          {!canSubmitClaim && warranty.status === 'active' && !warranty.is_valid && (
            <span className="text-sm text-muted-foreground">
              Гарантия истекла
            </span>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

// Compact version for lists
interface WarrantyCardCompactProps {
  warranty: WarrantyRegistrationWithProduct
  onClick?: () => void
}

export function WarrantyCardCompact({ warranty, onClick }: WarrantyCardCompactProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      {/* Product Image */}
      <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 overflow-hidden">
        {warranty.product_image_url ? (
          <img
            src={warranty.product_image_url}
            alt={warranty.product_name || 'Товар'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{warranty.product_name}</p>
        <p className="text-sm text-muted-foreground">
          До {formatDate(warranty.warranty_end)}
        </p>
      </div>

      {/* Status */}
      <WarrantyStatusBadge
        status={warranty.status}
        daysRemaining={warranty.days_remaining}
        showDays={false}
      />

      {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </div>
  )
}
