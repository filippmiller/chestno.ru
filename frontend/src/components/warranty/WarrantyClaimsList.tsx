import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Package,
  ChevronRight,
  Clock,
  User,
  MessageSquare,
  Image,
  AlertCircle,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { ClaimStatusBadge, PriorityBadge } from './WarrantyStatusBadge'
import type { WarrantyClaimWithDetails, ClaimStatus } from '@/types/warranty'
import { CLAIM_TYPE_LABELS, RESOLUTION_TYPE_LABELS } from '@/types/warranty'

interface WarrantyClaimsListProps {
  claims: WarrantyClaimWithDetails[]
  loading?: boolean
  emptyMessage?: string
  onClaimClick?: (claim: WarrantyClaimWithDetails) => void
  showCustomerInfo?: boolean // For business view
}

export function WarrantyClaimsList({
  claims,
  loading = false,
  emptyMessage = 'Нет гарантийных заявок',
  onClaimClick,
  showCustomerInfo = false,
}: WarrantyClaimsListProps) {
  const [selectedClaim, setSelectedClaim] = useState<WarrantyClaimWithDetails | null>(null)

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: ru,
    })
  }

  const handleClaimClick = (claim: WarrantyClaimWithDetails) => {
    if (onClaimClick) {
      onClaimClick(claim)
    } else {
      setSelectedClaim(claim)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg border bg-muted/50 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (claims.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {claims.map((claim) => (
          <Card
            key={claim.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleClaimClick(claim)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Product Icon or Image */}
                <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium truncate">
                        {claim.product_name || 'Товар'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {CLAIM_TYPE_LABELS[claim.claim_type]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ClaimStatusBadge status={claim.status} />
                      {claim.priority !== 'normal' && (
                        <PriorityBadge priority={claim.priority} />
                      )}
                    </div>
                  </div>

                  {/* Description preview */}
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {claim.description}
                  </p>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(claim.created_at)}
                    </span>
                    {showCustomerInfo && claim.customer_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {claim.customer_name}
                      </span>
                    )}
                    {claim.photos && claim.photos.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Image className="w-3 h-3" />
                        {claim.photos.length} фото
                      </span>
                    )}
                  </div>

                  {/* Resolution info if resolved */}
                  {claim.resolution_type && (
                    <div className="mt-2 flex items-center gap-1 text-sm">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Решение:</span>
                      <span className="font-medium">
                        {RESOLUTION_TYPE_LABELS[claim.resolution_type]}
                      </span>
                    </div>
                  )}
                </div>

                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Claim Details Dialog */}
      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent className="max-w-md">
          {selectedClaim && (
            <>
              <DialogHeader>
                <DialogTitle>Заявка #{selectedClaim.id.slice(0, 8)}</DialogTitle>
                <DialogDescription>
                  {selectedClaim.product_name} - {CLAIM_TYPE_LABELS[selectedClaim.claim_type]}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Статус:</span>
                  <ClaimStatusBadge status={selectedClaim.status} />
                </div>

                {/* Priority */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Приоритет:</span>
                  <PriorityBadge priority={selectedClaim.priority} />
                </div>

                {/* Created */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Создана:</span>
                  <span className="text-sm">{formatDate(selectedClaim.created_at)}</span>
                </div>

                {/* Description */}
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">
                    Описание:
                  </span>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">
                    {selectedClaim.description}
                  </p>
                </div>

                {/* Photos */}
                {selectedClaim.photos && selectedClaim.photos.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-2">
                      Фото ({selectedClaim.photos.length}):
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedClaim.photos.map((url, index) => (
                        <div
                          key={index}
                          className="aspect-square rounded-lg overflow-hidden bg-muted"
                        >
                          <img
                            src={url}
                            alt={`Фото ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolution */}
                {selectedClaim.resolution_type && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-1">
                      Решение:
                    </span>
                    <Badge variant="secondary" className="mb-2">
                      {RESOLUTION_TYPE_LABELS[selectedClaim.resolution_type]}
                    </Badge>
                    {selectedClaim.resolution_notes && (
                      <p className="text-sm bg-muted/50 rounded-lg p-3">
                        {selectedClaim.resolution_notes}
                      </p>
                    )}
                  </div>
                )}

                {/* Resolved at */}
                {selectedClaim.resolved_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Решена:</span>
                    <span className="text-sm">{formatDate(selectedClaim.resolved_at)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// Compact version for dashboard widgets
interface WarrantyClaimsCompactProps {
  claims: WarrantyClaimWithDetails[]
  maxItems?: number
  onViewAll?: () => void
}

export function WarrantyClaimsCompact({
  claims,
  maxItems = 5,
  onViewAll,
}: WarrantyClaimsCompactProps) {
  const displayClaims = claims.slice(0, maxItems)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">
          Последние заявки
        </CardTitle>
        {claims.length > maxItems && onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            Все заявки
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {displayClaims.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Нет активных заявок
          </p>
        ) : (
          <div className="space-y-2">
            {displayClaims.map((claim) => (
              <div
                key={claim.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {claim.product_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {CLAIM_TYPE_LABELS[claim.claim_type]}
                  </p>
                </div>
                <ClaimStatusBadge status={claim.status} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
