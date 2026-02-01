import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles, ShieldCheck, TrendingUp, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import type { ProductAlternative, TransparencyTier, AlternativesWidgetConfig } from '@/types/alternatives'
import { getBetterAlternatives, recordImpression, recordClick, getSessionId } from '@/api/alternatives'

export interface BetterAlternativesWidgetProps {
  /** Source product ID to find alternatives for */
  productId: string
  /** Source product's current transparency score (if known) */
  sourceScore?: number | null
  /** Widget configuration */
  config?: Partial<AlternativesWidgetConfig>
  /** A/B experiment ID (if running) */
  experimentId?: string | null
  /** Additional class names */
  className?: string
}

const DEFAULT_CONFIG: AlternativesWidgetConfig = {
  position: 'below-hero',
  maxAlternatives: 3,
  showOnlyIfLowScore: true,
  lowScoreThreshold: 60,
  showSponsoredLabel: true,
  showTransparencyComparison: true,
  enableTracking: true,
}

export function BetterAlternativesWidget({
  productId,
  sourceScore: initialSourceScore,
  config: userConfig,
  experimentId,
  className,
}: BetterAlternativesWidgetProps) {
  const config = { ...DEFAULT_CONFIG, ...userConfig }

  const [alternatives, setAlternatives] = useState<ProductAlternative[]>([])
  const [sourceScore, setSourceScore] = useState<number | null>(initialSourceScore ?? null)
  const [isLoading, setIsLoading] = useState(true)
  const [showWidget, setShowWidget] = useState(false)
  const [impressionIds, setImpressionIds] = useState<Map<string, string>>(new Map())

  // Fetch alternatives
  useEffect(() => {
    async function loadAlternatives() {
      setIsLoading(true)

      try {
        const sessionId = getSessionId()
        const response = await getBetterAlternatives({
          productId,
          limit: config.maxAlternatives,
          sessionId,
          experimentId,
        })

        setAlternatives(response.alternatives)
        setSourceScore(response.sourceProductScore)
        setShowWidget(response.showAlternatives)

        // Record impressions for tracking
        if (config.enableTracking && response.showAlternatives) {
          const newImpressionIds = new Map<string, string>()

          for (const alt of response.alternatives) {
            const impressionId = await recordImpression(
              productId,
              alt,
              sessionId,
              experimentId
            )
            if (impressionId) {
              newImpressionIds.set(alt.productId, impressionId)
            }
          }

          setImpressionIds(newImpressionIds)
        }
      } catch (error) {
        console.error('Failed to load alternatives:', error)
        setShowWidget(false)
      } finally {
        setIsLoading(false)
      }
    }

    loadAlternatives()
  }, [productId, config.maxAlternatives, config.enableTracking, experimentId])

  // Handle click tracking
  const handleAlternativeClick = useCallback(
    (alternative: ProductAlternative) => {
      if (!config.enableTracking) return

      const impressionId = impressionIds.get(alternative.productId)
      if (impressionId) {
        recordClick(impressionId)
      }
    },
    [config.enableTracking, impressionIds]
  )

  // Don't render if conditions aren't met
  if (isLoading) {
    return <AlternativesWidgetSkeleton className={className} />
  }

  if (!showWidget || alternatives.length === 0) {
    return null
  }

  return (
    <section className={cn('py-8', className)}>
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-xl font-semibold">
                Более прозрачные альтернативы
              </h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Эти продукты имеют более высокий уровень прозрачности:
                      подробная история происхождения, сертификаты качества
                      и проверенные заявления производителя.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground">
              Похожие товары с лучшей прозрачностью в той же ценовой категории
            </p>
          </div>

          {/* Transparency comparison summary */}
          {config.showTransparencyComparison && sourceScore !== null && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <span className="text-amber-800 dark:text-amber-200">
                У этих товаров прозрачность на{' '}
                <strong>
                  {Math.round(
                    (alternatives.reduce((sum, a) => sum + a.transparencyScore, 0) /
                      alternatives.length) -
                      sourceScore
                  )}
                  %
                </strong>{' '}
                выше
              </span>
            </div>
          )}
        </div>

        {/* Alternatives Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {alternatives.map((alternative) => (
            <AlternativeCard
              key={alternative.productId}
              alternative={alternative}
              sourceScore={sourceScore}
              showSponsoredLabel={config.showSponsoredLabel}
              showTransparencyComparison={config.showTransparencyComparison}
              onClick={() => handleAlternativeClick(alternative)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================
// Alternative Card Component
// ============================================================

interface AlternativeCardProps {
  alternative: ProductAlternative
  sourceScore: number | null
  showSponsoredLabel: boolean
  showTransparencyComparison: boolean
  onClick: () => void
}

function AlternativeCard({
  alternative,
  sourceScore,
  showSponsoredLabel,
  showTransparencyComparison,
  onClick,
}: AlternativeCardProps) {
  const transparencyImprovement =
    sourceScore !== null ? alternative.transparencyScore - sourceScore : null

  return (
    <Link
      to={`/product/${alternative.slug}`}
      onClick={onClick}
      className="group block"
    >
      <Card className="h-full overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/50 group-focus:ring-2 group-focus:ring-primary">
        <CardContent className="p-0">
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {alternative.imageUrl ? (
              <img
                src={alternative.imageUrl}
                alt={alternative.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <span className="text-4xl font-display text-muted-foreground/30">
                  {alternative.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Transparency Badge */}
            <div className="absolute top-3 right-3">
              <TransparencyBadge
                score={alternative.transparencyScore}
                tier={alternative.transparencyTier}
              />
            </div>

            {/* Sponsored Label */}
            {alternative.isSponsored && showSponsoredLabel && (
              <div className="absolute top-3 left-3">
                <Badge
                  variant="secondary"
                  className="bg-white/90 text-xs backdrop-blur-sm"
                >
                  Реклама
                </Badge>
              </div>
            )}

            {/* Transparency Improvement Chip */}
            {showTransparencyComparison && transparencyImprovement !== null && transparencyImprovement > 0 && (
              <div className="absolute bottom-3 left-3">
                <Badge className="bg-green-500 text-white text-xs">
                  +{transparencyImprovement}% прозрачности
                </Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Category & Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {alternative.category && (
                <Badge variant="outline" className="text-xs">
                  {alternative.category}
                </Badge>
              )}
              {alternative.organizationStatusLevel && (
                <StatusBadge
                  level={alternative.organizationStatusLevel}
                  size="sm"
                />
              )}
            </div>

            {/* Product Name */}
            <h3 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
              {alternative.name}
            </h3>

            {/* Producer */}
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              {alternative.organizationName}
            </p>

            {/* Price & CTA */}
            <div className="flex items-center justify-between pt-2 border-t">
              {alternative.priceCents ? (
                <span className="text-lg font-semibold text-primary">
                  {formatPrice(alternative.priceCents, alternative.currency || 'RUB')}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Цена по запросу</span>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-primary group-hover:bg-primary/10"
              >
                Подробнее
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ============================================================
// Transparency Badge Component
// ============================================================

interface TransparencyBadgeProps {
  score: number
  tier: TransparencyTier
}

function TransparencyBadge({ score, tier }: TransparencyBadgeProps) {
  const config = {
    excellent: {
      bg: 'bg-green-500',
      text: 'text-white',
      label: 'Отлично',
    },
    good: {
      bg: 'bg-green-400',
      text: 'text-white',
      label: 'Хорошо',
    },
    fair: {
      bg: 'bg-yellow-400',
      text: 'text-yellow-900',
      label: 'Удовл.',
    },
    low: {
      bg: 'bg-orange-400',
      text: 'text-orange-900',
      label: 'Низко',
    },
  }[tier]

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-lg backdrop-blur-sm',
        config.bg
      )}
    >
      <ShieldCheck className={cn('h-3.5 w-3.5', config.text)} />
      <span className={cn('text-xs font-semibold', config.text)}>{score}%</span>
    </div>
  )
}

// ============================================================
// Loading Skeleton
// ============================================================

function AlternativesWidgetSkeleton({ className }: { className?: string }) {
  return (
    <section className={cn('py-8', className)}>
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 space-y-2">
          <div className="h-6 w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-[4/3] bg-muted animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                <div className="h-5 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================
// Utilities
// ============================================================

function formatPrice(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('ru-RU', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export default BetterAlternativesWidget
