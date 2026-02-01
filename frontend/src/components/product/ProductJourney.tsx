import { useState } from 'react'
import {
  Leaf,
  Factory,
  ClipboardCheck,
  Package,
  Truck,
  Store,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProductJourneyStep } from '@/types/product'

export interface ProductJourneyProps {
  /** Journey steps data */
  steps: ProductJourneyStep[]
  /** Title override */
  title?: string
  /** Description override */
  description?: string
  /** Show expanded view by default */
  defaultExpanded?: boolean
  /** Additional class names */
  className?: string
}

const stageConfig: Record<ProductJourneyStep['stage'], {
  icon: typeof Leaf
  label: string
  color: string
  bgColor: string
}> = {
  sourcing: {
    icon: Leaf,
    label: 'Сырье',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  production: {
    icon: Factory,
    label: 'Производство',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  quality_check: {
    icon: ClipboardCheck,
    label: 'Контроль качества',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  packaging: {
    icon: Package,
    label: 'Упаковка',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  distribution: {
    icon: Truck,
    label: 'Доставка',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
  retail: {
    icon: Store,
    label: 'Продажа',
    color: 'text-pink-600',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
  },
}

/**
 * Timeline visualization component showing the product journey
 * from sourcing to retail with verified checkpoints.
 */
export function ProductJourney({
  steps,
  title = 'Путь продукта',
  description = 'Отслеживайте каждый этап от сырья до прилавка',
  defaultExpanded = false,
  className,
}: ProductJourneyProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [selectedStep, setSelectedStep] = useState<ProductJourneyStep | null>(null)

  // Sort steps by order
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order)
  const verifiedCount = steps.filter((s) => s.verified).length
  const verificationPercent = steps.length > 0 ? Math.round((verifiedCount / steps.length) * 100) : 0

  if (steps.length === 0) {
    return null
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {title}
              {verificationPercent === 100 && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  100% верифицировано
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0"
          >
            {isExpanded ? (
              <>
                Свернуть
                <ChevronUp className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                Подробнее
                <ChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Verification Progress */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Верификация этапов</span>
            <span className="font-medium">{verifiedCount} из {steps.length}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full transition-all duration-500',
                verificationPercent === 100 ? 'bg-green-500' : 'bg-primary'
              )}
              style={{ width: `${verificationPercent}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Compact Timeline View */}
        {!isExpanded && (
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {sortedSteps.map((step, idx) => {
              const config = stageConfig[step.stage]
              const Icon = config.icon
              const isLast = idx === sortedSteps.length - 1

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => {
                      setSelectedStep(step)
                      setIsExpanded(true)
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg p-2 transition-all',
                      'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring'
                    )}
                  >
                    <div
                      className={cn(
                        'relative flex h-10 w-10 items-center justify-center rounded-full transition-all',
                        config.bgColor
                      )}
                    >
                      <Icon className={cn('h-5 w-5', config.color)} />
                      {step.verified && (
                        <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 h-4 w-4 text-green-500 bg-white dark:bg-gray-900 rounded-full" />
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                      {config.label}
                    </span>
                  </button>
                  {!isLast && (
                    <div className="mx-1 h-0.5 w-8 bg-border" />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Expanded Timeline View */}
        {isExpanded && (
          <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

            {sortedSteps.map((step) => {
              const config = stageConfig[step.stage]
              const Icon = config.icon
              const isSelected = selectedStep?.id === step.id

              return (
                <div
                  key={step.id}
                  className={cn(
                    'relative pl-14 py-4 transition-colors',
                    isSelected && 'bg-muted/50 -mx-6 px-20 rounded-lg'
                  )}
                >
                  {/* Timeline Node */}
                  <div
                    className={cn(
                      'absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background transition-all',
                      step.verified ? 'border-green-500' : 'border-border',
                      isSelected && 'ring-2 ring-primary ring-offset-2'
                    )}
                  >
                    {step.verified ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <div className={cn('rounded-md p-1.5', config.bgColor)}>
                        <Icon className={cn('h-4 w-4', config.color)} />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {config.label}
                      </Badge>
                      {step.verified && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                          Верифицировано
                        </Badge>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="font-semibold">{step.title}</h4>

                    {/* Description */}
                    {step.description && (
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      {step.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {step.location}
                        </span>
                      )}
                      {step.date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(step.date)}
                        </span>
                      )}
                    </div>

                    {/* Media */}
                    {step.media_url && (
                      <div className="mt-3 overflow-hidden rounded-lg border">
                        <img
                          src={step.media_url}
                          alt={step.title}
                          className="h-48 w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
