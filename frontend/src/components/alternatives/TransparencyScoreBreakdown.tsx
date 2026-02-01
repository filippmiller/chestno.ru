import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Route,
  Award,
  CheckCircle2,
  Building2,
  MessageSquare,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { TransparencyScore, TransparencyTier } from '@/types/alternatives'

export interface TransparencyScoreBreakdownProps {
  score: TransparencyScore | null
  isLoading?: boolean
  className?: string
}

interface ScoreComponent {
  key: keyof Omit<TransparencyScore, 'productId' | 'totalScore' | 'transparencyTier' | 'lastCalculatedAt'>
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  weight: number
}

const SCORE_COMPONENTS: ScoreComponent[] = [
  {
    key: 'journeyCompletenessScore',
    label: 'Путь продукта',
    description: 'Насколько полно задокументирован путь продукта от сырья до полки',
    icon: Route,
    weight: 25,
  },
  {
    key: 'certificationScore',
    label: 'Сертификация',
    description: 'Наличие действующих сертификатов качества и безопасности',
    icon: Award,
    weight: 20,
  },
  {
    key: 'claimVerificationScore',
    label: 'Проверка заявлений',
    description: 'Подтверждены ли заявления производителя документами',
    icon: CheckCircle2,
    weight: 20,
  },
  {
    key: 'producerStatusScore',
    label: 'Статус производителя',
    description: 'Уровень верификации и репутация компании на платформе',
    icon: Building2,
    weight: 20,
  },
  {
    key: 'reviewAuthenticityScore',
    label: 'Подлинность отзывов',
    description: 'Оценка достоверности отзывов покупателей',
    icon: MessageSquare,
    weight: 15,
  },
]

export function TransparencyScoreBreakdown({
  score,
  isLoading,
  className,
}: TransparencyScoreBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (isLoading) {
    return <TransparencyScoreSkeleton className={className} />
  }

  if (!score) {
    return null
  }

  const tierConfig = getTierConfig(score.transparencyTier)

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Оценка прозрачности
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Оценка основана на 5 компонентах, каждый из которых оценивается
                    по 100-балльной шкале и имеет свой вес в итоговом расчете.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>

          {/* Overall Score Badge */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5',
              tierConfig.bg
            )}
          >
            <span className={cn('text-2xl font-bold', tierConfig.text)}>
              {score.totalScore}
            </span>
            <span className={cn('text-sm', tierConfig.text)}>/ 100</span>
          </div>
        </div>

        {/* Tier Label */}
        <p className={cn('text-sm font-medium', tierConfig.labelColor)}>
          {tierConfig.label}
        </p>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Progress Bar */}
        <div className="relative mb-4">
          <Progress value={score.totalScore} className="h-3" />
          <div className="absolute inset-0 flex items-center">
            {/* Tier Markers */}
            <div
              className="absolute h-full border-l-2 border-dashed border-orange-400/50"
              style={{ left: '40%' }}
            />
            <div
              className="absolute h-full border-l-2 border-dashed border-yellow-400/50"
              style={{ left: '60%' }}
            />
            <div
              className="absolute h-full border-l-2 border-dashed border-green-400/50"
              style={{ left: '80%' }}
            />
          </div>
        </div>

        {/* Tier Scale Labels */}
        <div className="flex justify-between text-xs text-muted-foreground mb-6">
          <span>Низко</span>
          <span>Удовл.</span>
          <span>Хорошо</span>
          <span>Отлично</span>
        </div>

        {/* Expand/Collapse Button */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>Подробная разбивка</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        {/* Detailed Breakdown */}
        {isExpanded && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {SCORE_COMPONENTS.map((component) => {
              const value = score[component.key]
              const Icon = component.icon

              return (
                <div key={component.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{component.label}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground">
                              <HelpCircle className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{component.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Вес в итоговой оценке: {component.weight}%
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          getScoreColor(value)
                        )}
                      >
                        {value}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({component.weight}%)
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={value}
                    className={cn('h-2', getProgressColor(value))}
                  />
                </div>
              )
            })}

            {/* Calculation Date */}
            <p className="text-xs text-muted-foreground pt-2 border-t">
              Последний расчет:{' '}
              {new Date(score.lastCalculatedAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Helper Functions
// ============================================================

function getTierConfig(tier: TransparencyTier) {
  return {
    excellent: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      label: 'Отличная прозрачность',
      labelColor: 'text-green-600 dark:text-green-400',
    },
    good: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-600 dark:text-green-400',
      label: 'Хорошая прозрачность',
      labelColor: 'text-green-500',
    },
    fair: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-300',
      label: 'Удовлетворительная прозрачность',
      labelColor: 'text-yellow-600',
    },
    low: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-700 dark:text-orange-300',
      label: 'Низкая прозрачность',
      labelColor: 'text-orange-600',
    },
  }[tier]
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-green-500'
  if (score >= 40) return 'text-yellow-600'
  return 'text-orange-600'
}

function getProgressColor(score: number): string {
  if (score >= 80) return '[&>div]:bg-green-500'
  if (score >= 60) return '[&>div]:bg-green-400'
  if (score >= 40) return '[&>div]:bg-yellow-400'
  return '[&>div]:bg-orange-400'
}

// ============================================================
// Loading Skeleton
// ============================================================

function TransparencyScoreSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
          <div className="h-10 w-24 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="h-4 w-48 bg-muted animate-pulse rounded mt-2" />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-3 w-full bg-muted animate-pulse rounded mb-4" />
        <div className="flex justify-between">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 w-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default TransparencyScoreBreakdown
