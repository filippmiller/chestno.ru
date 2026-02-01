import { cn } from '@/lib/utils'
import {
  Leaf,
  TrendingDown,
  Truck,
  Package,
  Factory,
  Award,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'
import { EcoBadge, EcoScoreBar } from './EcoBadge'
import type { EcoComparison, EcoGrade } from '@/types/eco'
import { ECO_GRADE_CONFIG } from '@/types/eco'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface EcoComparisonCardProps {
  comparison: EcoComparison
  className?: string
  variant?: 'full' | 'compact' | 'minimal'
  showBreakdown?: boolean
}

export function EcoComparisonCard({
  comparison,
  className,
  variant = 'full',
  showBreakdown = true,
}: EcoComparisonCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (!comparison.eco_grade) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <Info className="w-5 h-5 mr-2" />
          <span>Эко-данные пока не добавлены</span>
        </CardContent>
      </Card>
    )
  }

  const gradeConfig = ECO_GRADE_CONFIG[comparison.eco_grade]
  const hasCO2Savings = comparison.co2_reduction_percentage !== null &&
    comparison.co2_reduction_percentage > 0

  if (variant === 'minimal') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-3 rounded-lg border px-4 py-3',
          gradeConfig.bgColor,
          gradeConfig.borderColor,
          className
        )}
      >
        <EcoBadge
          grade={comparison.eco_grade}
          size="md"
          showTooltip={false}
        />
        <div className="flex flex-col">
          <span className={cn('font-semibold text-sm', gradeConfig.textColor)}>
            Эко-рейтинг: {comparison.total_score}/100
          </span>
          {hasCO2Savings && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <TrendingDown className="w-3 h-3" />
              {comparison.co2_reduction_percentage}% меньше CO2
            </span>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div
          className={cn(
            'flex items-center justify-between p-4',
            gradeConfig.bgColor
          )}
        >
          <div className="flex items-center gap-4">
            <EcoBadge
              grade={comparison.eco_grade}
              score={comparison.total_score}
              co2ReductionPercent={comparison.co2_reduction_percentage}
              size="lg"
              showTooltip={false}
            />
            <div>
              <h4 className={cn('font-semibold', gradeConfig.textColor)}>
                {gradeConfig.label}
              </h4>
              <p className="text-sm text-muted-foreground">
                {gradeConfig.description}
              </p>
            </div>
          </div>

          {hasCO2Savings && (
            <div className="text-right">
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold text-lg">
                <TrendingDown className="w-5 h-5" />
                {comparison.co2_reduction_percentage}%
              </div>
              <span className="text-xs text-muted-foreground">меньше CO2</span>
            </div>
          )}
        </div>

        {showBreakdown && (
          <CardContent className="pt-4">
            <ScoreBreakdownCompact
              transport={comparison.transport_score}
              packaging={comparison.packaging_score}
              production={comparison.production_score}
              certification={comparison.certification_score}
            />
          </CardContent>
        )}
      </Card>
    )
  }

  // Full variant
  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header with grade */}
      <div
        className={cn(
          'relative overflow-hidden',
          gradeConfig.bgColor
        )}
      >
        {/* Decorative leaf pattern */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <Leaf
              key={i}
              className="absolute text-current"
              style={{
                left: `${i * 20}%`,
                top: `${(i % 2) * 40 + 20}%`,
                transform: `rotate(${i * 60}deg)`,
                width: '32px',
                height: '32px',
              }}
            />
          ))}
        </div>

        <CardHeader className="relative z-10 pb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <EcoBadge
                grade={comparison.eco_grade}
                size="xl"
                showTooltip={false}
              />
              <div>
                <CardTitle className={cn('text-xl', gradeConfig.textColor)}>
                  {gradeConfig.label}
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  {gradeConfig.description}
                </CardDescription>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl font-bold">{comparison.total_score}</span>
                  <span className="text-muted-foreground">/100 баллов</span>
                </div>
              </div>
            </div>

            {hasCO2Savings && (
              <div
                className="flex flex-col items-center justify-center p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
              >
                <TrendingDown className="w-6 h-6 text-green-600 dark:text-green-400" />
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {comparison.co2_reduction_percentage}%
                </span>
                <span className="text-xs text-green-700 dark:text-green-300 text-center">
                  меньше CO2
                  <br />
                  чем импорт
                </span>
              </div>
            )}
          </div>
        </CardHeader>
      </div>

      <CardContent className="pt-6">
        {/* CO2 Comparison Bar */}
        {comparison.estimated_co2_kg !== null && comparison.import_avg_co2_kg !== null && (
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Factory className="w-4 h-4" />
              Сравнение углеродного следа
            </h4>
            <CO2ComparisonBar
              productCO2={comparison.estimated_co2_kg}
              importCO2={comparison.import_avg_co2_kg}
            />
          </div>
        )}

        {/* Score Breakdown */}
        {showBreakdown && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full mb-3"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Детали оценки
            </button>

            {expanded && (
              <ScoreBreakdownFull
                transport={comparison.transport_score}
                packaging={comparison.packaging_score}
                production={comparison.production_score}
                certification={comparison.certification_score}
                dataCompleteness={comparison.data_completeness}
              />
            )}

            {!expanded && (
              <ScoreBreakdownCompact
                transport={comparison.transport_score}
                packaging={comparison.packaging_score}
                production={comparison.production_score}
                certification={comparison.certification_score}
              />
            )}
          </div>
        )}

        {/* Data Completeness Warning */}
        {comparison.data_completeness !== null && comparison.data_completeness < 50 && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-yellow-700 dark:text-yellow-300">
                  Неполные данные ({comparison.data_completeness}%)
                </span>
                <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                  Добавьте больше экологических данных для более точной оценки
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// CO2 Comparison Bar
function CO2ComparisonBar({
  productCO2,
  importCO2,
}: {
  productCO2: number
  importCO2: number
}) {
  const maxCO2 = Math.max(productCO2, importCO2)
  const productWidth = (productCO2 / maxCO2) * 100
  const importWidth = (importCO2 / maxCO2) * 100
  const savings = importCO2 - productCO2

  return (
    <div className="space-y-3">
      {/* This Product */}
      <div className="flex items-center gap-3">
        <span className="w-24 text-xs text-right">Этот продукт</span>
        <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
            style={{ width: `${productWidth}%` }}
          >
            <span className="text-xs font-medium text-white">
              {productCO2.toFixed(2)} кг
            </span>
          </div>
        </div>
      </div>

      {/* Import Average */}
      <div className="flex items-center gap-3">
        <span className="w-24 text-xs text-right text-muted-foreground">Импортный аналог</span>
        <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-400 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
            style={{ width: `${importWidth}%` }}
          >
            <span className="text-xs font-medium text-white">
              {importCO2.toFixed(2)} кг
            </span>
          </div>
        </div>
      </div>

      {/* Savings */}
      {savings > 0 && (
        <div className="text-center text-sm">
          <span className="text-green-600 dark:text-green-400 font-medium">
            Экономия: {savings.toFixed(2)} кг CO2
          </span>
        </div>
      )}
    </div>
  )
}

// Compact Score Breakdown
function ScoreBreakdownCompact({
  transport,
  packaging,
  production,
  certification,
}: {
  transport?: number | null
  packaging?: number | null
  production?: number | null
  certification?: number | null
}) {
  const categories = [
    { icon: Truck, label: 'Транспорт', score: transport, weight: 30 },
    { icon: Package, label: 'Упаковка', score: packaging, weight: 25 },
    { icon: Factory, label: 'Производство', score: production, weight: 30 },
    { icon: Award, label: 'Сертификаты', score: certification, weight: 15 },
  ]

  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map(({ icon: Icon, label, score, weight }) => (
        <TooltipProvider key={label}>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50 cursor-help">
                <Icon className="w-4 h-4 mb-1 text-muted-foreground" />
                <span className="text-lg font-bold">
                  {score !== null && score !== undefined ? score : '-'}
                </span>
                <span className="text-[10px] text-muted-foreground">{weight}%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{label}: {score ?? 'Нет данных'}/100</p>
              <p className="text-xs text-muted-foreground">Вес в общей оценке: {weight}%</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  )
}

// Full Score Breakdown
function ScoreBreakdownFull({
  transport,
  packaging,
  production,
  certification,
  dataCompleteness,
}: {
  transport?: number | null
  packaging?: number | null
  production?: number | null
  certification?: number | null
  dataCompleteness?: number | null
}) {
  const categories = [
    {
      icon: Truck,
      label: 'Транспорт',
      description: 'Расстояние и способ доставки',
      score: transport,
      weight: 30,
      color: '#3B82F6',
    },
    {
      icon: Package,
      label: 'Упаковка',
      description: 'Материал и перерабатываемость',
      score: packaging,
      weight: 25,
      color: '#8B5CF6',
    },
    {
      icon: Factory,
      label: 'Производство',
      description: 'Энергия и управление отходами',
      score: production,
      weight: 30,
      color: '#F59E0B',
    },
    {
      icon: Award,
      label: 'Сертификаты',
      description: 'Экологические сертификации',
      score: certification,
      weight: 15,
      color: '#10B981',
    },
  ]

  return (
    <div className="space-y-4">
      {categories.map(({ icon: Icon, label, description, score, weight, color }) => (
        <div key={label} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {score !== null && score !== undefined ? score : '-'}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${score ?? 0}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">Вес: {weight}%</span>
        </div>
      ))}

      {dataCompleteness !== null && dataCompleteness !== undefined && (
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Полнота данных</span>
            <span className="font-medium">{dataCompleteness}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default EcoComparisonCard
