import { Link } from 'react-router-dom'
import { ExternalLink, MapPin, Calendar, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge, type StatusLevel } from '@/components/StatusBadge'
import { FollowButtonIcon } from '@/components/follow/FollowButton'
import { cn } from '@/lib/utils'

export interface DiscoveryCardProps {
  /** Unique identifier */
  id: string
  /** Type of discovery */
  type: 'product' | 'organization'
  /** Name of the item */
  name: string
  /** URL slug for linking */
  slug: string
  /** Image URL */
  imageUrl?: string | null
  /** Short description */
  description?: string | null
  /** Category/tags */
  category?: string | null
  /** Location info */
  location?: {
    city?: string | null
    country?: string | null
  }
  /** Status level */
  statusLevel?: StatusLevel | null
  /** Is verified */
  isVerified?: boolean
  /** Producer info (for products) */
  producer?: {
    name: string
    slug: string
  } | null
  /** Price (for products) */
  price?: {
    cents: number
    currency: string
  } | null
  /** Rating */
  rating?: {
    average: number
    count: number
  } | null
  /** Discovery date */
  discoveredAt?: string | null
  /** Is currently followed */
  isFollowed?: boolean
  /** Callback for follow action */
  onFollowChange?: (isFollowed: boolean) => Promise<void> | void
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional class names */
  className?: string
}

const sizeConfig = {
  sm: {
    card: 'max-w-[280px]',
    image: 'aspect-[4/3]',
    title: 'text-base',
    description: 'line-clamp-2',
  },
  md: {
    card: 'max-w-[340px]',
    image: 'aspect-[16/10]',
    title: 'text-lg',
    description: 'line-clamp-2',
  },
  lg: {
    card: 'max-w-[400px]',
    image: 'aspect-[16/9]',
    title: 'text-xl',
    description: 'line-clamp-3',
  },
}

/**
 * Card component for displaying product/organization discoveries.
 * Used in feeds, search results, and recommendation sections.
 */
export function DiscoveryCard({
  type,
  name,
  slug,
  imageUrl,
  description,
  category,
  location,
  statusLevel,
  isVerified,
  producer,
  price,
  rating,
  discoveredAt,
  isFollowed,
  onFollowChange,
  size = 'md',
  className,
}: DiscoveryCardProps) {
  const config = sizeConfig[size]
  const linkUrl = type === 'product' ? `/product/${slug}` : `/org/${slug}`

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-300',
        'hover:shadow-lg hover:-translate-y-0.5',
        config.card,
        className
      )}
    >
      <CardContent className="p-0">
        {/* Image Section */}
        <Link to={linkUrl} className="block">
          <div className={cn('relative overflow-hidden bg-muted', config.image)}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <span className="text-4xl font-display text-muted-foreground/30">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Overlay badges */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* Top badges */}
            <div className="absolute top-2 left-2 flex gap-1.5">
              {statusLevel && (
                <StatusBadge level={statusLevel} size="sm" showTooltip={false} />
              )}
              {isVerified && (
                <Badge variant="secondary" className="bg-green-500/90 text-white text-[10px] border-0">
                  Проверено
                </Badge>
              )}
            </div>

            {/* Category badge */}
            {category && (
              <Badge
                variant="secondary"
                className="absolute bottom-2 left-2 bg-white/90 dark:bg-black/70 text-[10px] backdrop-blur-sm"
              >
                {category}
              </Badge>
            )}
          </div>
        </Link>

        {/* Content Section */}
        <div className="p-3 space-y-2">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-2">
            <Link to={linkUrl} className="flex-1 min-w-0">
              <h3
                className={cn(
                  'font-semibold leading-tight hover:text-primary transition-colors',
                  'line-clamp-2',
                  config.title
                )}
              >
                {name}
              </h3>
            </Link>
            {onFollowChange && (
              <FollowButtonIcon
                isFollowed={isFollowed}
                onFollowChange={onFollowChange}
                size="sm"
              />
            )}
          </div>

          {/* Producer link (for products) */}
          {producer && type === 'product' && (
            <Link
              to={`/org/${producer.slug}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              {producer.name}
            </Link>
          )}

          {/* Description */}
          {description && (
            <p className={cn('text-sm text-muted-foreground', config.description)}>
              {description}
            </p>
          )}

          {/* Meta Row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {location && (location.city || location.country) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[location.city, location.country].filter(Boolean).join(', ')}
              </span>
            )}
            {rating && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {rating.average.toFixed(1)} ({rating.count})
              </span>
            )}
            {discoveredAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatRelativeDate(discoveredAt)}
              </span>
            )}
          </div>

          {/* Price Row (for products) */}
          {price && (
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-lg font-semibold text-primary">
                {formatPrice(price.cents, price.currency)}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link to={linkUrl}>Подробнее</Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
