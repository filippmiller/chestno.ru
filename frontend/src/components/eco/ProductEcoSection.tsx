import { useState, useEffect } from 'react'
import { Leaf, TrendingDown, MapPin, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EcoBadge, EcoScoreBar } from './EcoBadge'
import { EcoComparisonCard } from './EcoComparisonCard'
import type { EcoComparison, ProductEcoData, EcoGrade } from '@/types/eco'
import { ECO_GRADE_CONFIG } from '@/types/eco'
import { getEcoComparison, getProductEcoData } from '@/api/eco'

interface ProductEcoSectionProps {
  productId: string
  productName: string
  className?: string
}

export function ProductEcoSection({
  productId,
  productName,
  className,
}: ProductEcoSectionProps) {
  const [comparison, setComparison] = useState<EcoComparison | null>(null)
  const [ecoData, setEcoData] = useState<ProductEcoData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showFullCard, setShowFullCard] = useState(false)

  useEffect(() => {
    async function loadEcoData() {
      try {
        const [compData, rawData] = await Promise.all([
          getEcoComparison(productId),
          getProductEcoData(productId),
        ])
        setComparison(compData)
        setEcoData(rawData)
      } catch (error) {
        console.error('Failed to load eco data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadEcoData()
  }, [productId])

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="py-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!comparison?.eco_grade) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Leaf className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Эко-рейтинг пока не рассчитан</p>
              <p className="text-sm text-muted-foreground">
                Производитель еще не добавил экологические данные
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const gradeConfig = ECO_GRADE_CONFIG[comparison.eco_grade]
  const hasCO2Data = comparison.co2_reduction_percentage !== null &&
    comparison.co2_reduction_percentage > 0

  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-600" />
          Экологический рейтинг
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFullCard(!showFullCard)}
          className="text-muted-foreground"
        >
          {showFullCard ? 'Скрыть детали' : 'Подробнее'}
          <ChevronRight className={cn(
            'w-4 h-4 ml-1 transition-transform',
            showFullCard && 'rotate-90'
          )} />
        </Button>
      </div>

      {!showFullCard ? (
        // Compact View
        <Card className="overflow-hidden">
          <div
            className={cn(
              'p-6',
              gradeConfig.bgColor
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <EcoBadge
                  grade={comparison.eco_grade}
                  score={comparison.total_score}
                  size="xl"
                  showTooltip={false}
                />
                <div>
                  <h3 className={cn('text-lg font-semibold', gradeConfig.textColor)}>
                    {gradeConfig.label}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {gradeConfig.description}
                  </p>
                  <p className="text-sm mt-1">
                    <span className="font-medium">{comparison.total_score}</span>
                    <span className="text-muted-foreground">/100 баллов</span>
                  </p>
                </div>
              </div>

              {hasCO2Data && (
                <div className="flex flex-col items-center justify-center px-6 py-3 rounded-lg bg-white/50 dark:bg-black/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                    <TrendingDown className="w-5 h-5" />
                    <span className="text-2xl font-bold">
                      {comparison.co2_reduction_percentage}%
                    </span>
                  </div>
                  <span className="text-xs text-green-700 dark:text-green-300 text-center">
                    меньше CO2
                    <br />
                    чем импорт
                  </span>
                </div>
              )}
            </div>

            {/* Quick Facts */}
            {ecoData && (
              <div className="mt-4 pt-4 border-t border-current/10 flex flex-wrap gap-4 text-sm">
                {ecoData.production_location_name && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>Произведено: {ecoData.production_location_name}</span>
                  </div>
                )}
                {ecoData.transport_distance_km && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>Расстояние: {ecoData.transport_distance_km} км</span>
                  </div>
                )}
                {ecoData.packaging_is_recyclable && (
                  <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Перерабатываемая упаковка</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      ) : (
        // Full View
        <EcoComparisonCard
          comparison={comparison}
          variant="full"
          showBreakdown
        />
      )}
    </section>
  )
}

// Inline Eco Badge for Hero section
export function ProductEcoBadgeInline({
  productId,
  className,
}: {
  productId: string
  className?: string
}) {
  const [comparison, setComparison] = useState<EcoComparison | null>(null)

  useEffect(() => {
    getEcoComparison(productId)
      .then(setComparison)
      .catch(console.error)
  }, [productId])

  if (!comparison?.eco_grade) return null

  const gradeConfig = ECO_GRADE_CONFIG[comparison.eco_grade]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 shadow-lg backdrop-blur-sm',
        gradeConfig.bgColor,
        gradeConfig.borderColor,
        'border',
        className
      )}
    >
      <Leaf className={cn('h-4 w-4', gradeConfig.textColor)} />
      <EcoBadge
        grade={comparison.eco_grade}
        size="sm"
        showTooltip={false}
        variant="minimal"
      />
      {comparison.co2_reduction_percentage !== null && comparison.co2_reduction_percentage > 0 && (
        <span className="text-xs font-medium text-green-600 dark:text-green-400">
          -{comparison.co2_reduction_percentage}% CO2
        </span>
      )}
    </div>
  )
}

export default ProductEcoSection
