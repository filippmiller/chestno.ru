import { Link } from 'react-router-dom'
import { ExternalLink, Share2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge, type StatusLevel } from '@/components/StatusBadge'
import { FollowButton } from '@/components/follow/FollowButton'
import { cn } from '@/lib/utils'

export interface ProductHeroProps {
  /** Product name */
  name: string
  /** Product image URL */
  imageUrl?: string | null
  /** Product gallery */
  gallery?: Array<{ url: string; caption?: string | null }> | null
  /** Short description */
  description?: string | null
  /** Category */
  category?: string | null
  /** Tags */
  tags?: string | null
  /** Price */
  price?: {
    cents: number
    currency: string
  } | null
  /** External purchase URL */
  externalUrl?: string | null
  /** Producer information */
  producer: {
    id: string
    name: string
    slug: string
    isVerified: boolean
    statusLevel?: StatusLevel | null
    imageUrl?: string | null
  }
  /** Trust score (0-100) */
  trustScore?: number | null
  /** Verified claims list */
  verifiedClaims?: string[]
  /** Number of followers */
  followerCount?: number
  /** Whether current user follows this product */
  isFollowed?: boolean
  /** Callback when follow state changes */
  onFollowChange?: (isFollowed: boolean) => Promise<void> | void
  /** Callback when share button clicked */
  onShare?: () => void
  /** Additional class names */
  className?: string
}

export function ProductHero({
  name,
  imageUrl,
  gallery,
  description,
  category,
  tags,
  price,
  externalUrl,
  producer,
  trustScore,
  verifiedClaims = [],
  followerCount = 0,
  isFollowed,
  onFollowChange,
  onShare,
  className,
}: ProductHeroProps) {
  const allImages = [
    ...(imageUrl ? [{ url: imageUrl, caption: name }] : []),
    ...(gallery ?? []),
  ].slice(0, 5)

  const tagList = tags?.split(',').map((t) => t.trim()).filter(Boolean) ?? []

  return (
    <section className={cn('py-8 lg:py-12', className)}>
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Image Gallery Section */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
              {allImages[0] ? (
                <img
                  src={allImages[0].url}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                  <span className="text-6xl font-display text-muted-foreground/30">
                    {name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              {/* Trust Badge Overlay */}
              {trustScore !== null && trustScore !== undefined && (
                <div className="absolute top-4 right-4">
                  <TrustBadge score={trustScore} />
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    className={cn(
                      'relative shrink-0 h-20 w-20 overflow-hidden rounded-lg border-2 transition-all',
                      idx === 0
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-primary/50'
                    )}
                  >
                    <img
                      src={img.url}
                      alt={img.caption ?? `${name} - ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info Section */}
          <div className="flex flex-col gap-6">
            {/* Category & Status */}
            <div className="flex flex-wrap items-center gap-2">
              {category && (
                <Badge variant="secondary" className="text-xs">
                  {category}
                </Badge>
              )}
              {producer.statusLevel && (
                <StatusBadge level={producer.statusLevel} size="md" />
              )}
              {producer.isVerified && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Проверено
                </Badge>
              )}
            </div>

            {/* Product Name */}
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {name}
            </h1>

            {/* Producer Link */}
            <div className="flex items-center gap-3">
              <Link
                to={`/org/${producer.slug}`}
                className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {producer.imageUrl ? (
                  <img
                    src={producer.imageUrl}
                    alt={producer.name}
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-border group-hover:ring-primary/50 transition-all"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {producer.name.charAt(0)}
                  </div>
                )}
                <span className="font-medium">{producer.name}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>

            {/* Description */}
            {description && (
              <p className="text-lg text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}

            {/* Verified Claims */}
            {verifiedClaims.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Подтверждено:
                </p>
                <div className="flex flex-wrap gap-2">
                  {verifiedClaims.map((claim, idx) => (
                    <Badge key={idx} variant="outline" className="bg-green-50/50 dark:bg-green-950/30">
                      <ShieldCheck className="mr-1 h-3 w-3 text-green-600" />
                      {claim}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            {price && (
              <div className="text-3xl font-bold text-primary">
                {formatPrice(price.cents, price.currency)}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {externalUrl && (
                <Button size="lg" className="min-w-[160px]" asChild>
                  <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                    Где купить
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              
              <FollowButton
                isFollowed={isFollowed}
                onFollowChange={onFollowChange}
                followerCount={followerCount}
                showCount
                size="lg"
              />

              {onShare && (
                <Button variant="outline" size="lg" onClick={onShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Tags */}
            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {tagList.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Trust score badge with visual indicator */
function TrustBadge({ score }: { score: number }) {
  const getConfig = (score: number) => {
    if (score >= 90) return { label: 'Высочайшее', color: 'bg-green-500', textColor: 'text-green-50' }
    if (score >= 75) return { label: 'Высокое', color: 'bg-green-400', textColor: 'text-green-50' }
    if (score >= 60) return { label: 'Хорошее', color: 'bg-yellow-400', textColor: 'text-yellow-900' }
    return { label: 'Базовое', color: 'bg-orange-400', textColor: 'text-orange-900' }
  }

  const config = getConfig(score)

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-full px-3 py-1.5 shadow-lg backdrop-blur-sm',
      config.color
    )}>
      <ShieldCheck className={cn('h-4 w-4', config.textColor)} />
      <div className={cn('text-sm font-semibold', config.textColor)}>
        {score}%
      </div>
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
