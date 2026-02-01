import { forwardRef } from 'react'
import { Share2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusLevel } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'

export interface ShareCardProps {
  /** Product or organization name */
  name: string
  /** Type of the item */
  type: 'product' | 'organization'
  /** Image URL */
  imageUrl?: string | null
  /** Description text */
  description?: string | null
  /** Status level badge */
  statusLevel?: StatusLevel | null
  /** Producer name (for products) */
  producerName?: string | null
  /** Whether the item is verified */
  isVerified?: boolean
  /** Trust score percentage */
  trustScore?: number | null
  /** Price for products */
  price?: {
    cents: number
    currency: string
  } | null
  /** Callback when share button is clicked */
  onShare?: () => void
  /** Additional class names */
  className?: string
}

/**
 * Pre-designed card optimized for social sharing.
 * Uses attractive gradients and clear typography to encourage sharing.
 */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  (
    {
      name,
      type,
      imageUrl,
      description,
      statusLevel,
      producerName,
      isVerified,
      trustScore,
      price,
      onShare,
      className,
    },
    ref
  ) => {
    return (
      <Card
        ref={ref}
        className={cn(
          'relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/30',
          'shadow-lg hover:shadow-xl transition-shadow duration-300',
          className
        )}
      >
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

        <CardContent className="relative p-0">
          {/* Image Section */}
          {imageUrl && (
            <div className="relative aspect-[16/9] overflow-hidden">
              <img
                src={imageUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              
              {/* Badges on image */}
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                {statusLevel && (
                  <StatusBadge level={statusLevel} size="sm" showTooltip={false} />
                )}
                {isVerified && (
                  <span className="inline-flex items-center rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    Проверено
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Content Section */}
          <div className="p-4 space-y-3">
            {/* Type Label */}
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {type === 'product' ? 'Товар' : 'Производитель'}
            </p>

            {/* Name */}
            <h3 className="font-display text-xl font-semibold leading-tight line-clamp-2">
              {name}
            </h3>

            {/* Producer (for products) */}
            {producerName && type === 'product' && (
              <p className="text-sm text-muted-foreground">
                от <span className="font-medium text-foreground">{producerName}</span>
              </p>
            )}

            {/* Description */}
            {description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}

            {/* Bottom Row: Price/Trust Score + Share */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-3">
                {price && (
                  <span className="text-lg font-semibold text-primary">
                    {formatPrice(price.cents, price.currency)}
                  </span>
                )}
                {trustScore !== null && trustScore !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <TrustMeter score={trustScore} />
                    <span className="text-xs text-muted-foreground">
                      {trustScore}% честности
                    </span>
                  </div>
                )}
              </div>

              {onShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onShare}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Share2 className="h-4 w-4 mr-1.5" />
                  Поделиться
                </Button>
              )}
            </div>
          </div>

          {/* Chestno.ru branding */}
          <div className="absolute top-3 right-3">
            <div className="rounded-full bg-white/90 dark:bg-black/70 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm shadow-sm">
              Chestno.ru
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
)

ShareCard.displayName = 'ShareCard'

/** Mini trust score visualization */
function TrustMeter({ score }: { score: number }) {
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-orange-500'
  }

  return (
    <div className="flex h-2 w-12 overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full transition-all duration-500', getColor(score))}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

function formatPrice(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('ru-RU', {
    style: 'currency',
    currency: currency || 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
