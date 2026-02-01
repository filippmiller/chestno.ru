/**
 * Points Calculator Component
 *
 * Real-time preview of points user will earn for their review.
 * Shows breakdown of bonuses and encourages quality content.
 */
import { useEffect, useState } from 'react'
import {
  Camera,
  CheckCircle,
  FileText,
  Info,
  Sparkles,
  ThumbsUp,
  Video,
} from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { calculatePoints } from '@/api/rewardsService'
import type { ReviewQualityBreakdown, ReviewQualityConfig } from '@/types/rewards'
import { LENGTH_TIER_LABELS } from '@/types/rewards'

interface PointsCalculatorProps {
  wordCount: number
  photoCount: number
  videoCount: number
  isVerifiedPurchase?: boolean
  className?: string
}

export function PointsCalculator({
  wordCount,
  photoCount,
  videoCount,
  isVerifiedPurchase = false,
  className = '',
}: PointsCalculatorProps) {
  const [breakdown, setBreakdown] = useState<ReviewQualityBreakdown | null>(null)
  const [config, setConfig] = useState<ReviewQualityConfig | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCalculation()
    }, 300) // Debounce API calls

    return () => clearTimeout(debounce)
  }, [wordCount, photoCount, videoCount, isVerifiedPurchase])

  const fetchCalculation = async () => {
    try {
      setLoading(true)
      const result = await calculatePoints({
        word_count: wordCount,
        photo_count: photoCount,
        video_count: videoCount,
        is_verified_purchase: isVerifiedPurchase,
      })
      setBreakdown(result.breakdown)
      setConfig(result.config)
    } catch (error) {
      console.error('Failed to calculate points:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!breakdown || !config) {
    return (
      <div className={`rounded-lg border bg-card p-4 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Подсчёт баллов...</span>
        </div>
      </div>
    )
  }

  const qualityPercent = breakdown.quality_score

  return (
    <div className={`rounded-lg border bg-card ${className}`}>
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">Баллы за отзыв</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">
              +{breakdown.total_points}
            </span>
            <span className="ml-1 text-sm text-muted-foreground">баллов</span>
          </div>
        </div>

        {/* Quality Score */}
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Качество отзыва</span>
            <span className="font-medium">
              {qualityPercent}/100
            </span>
          </div>
          <Progress
            value={qualityPercent}
            className="h-2"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {getLevelDescription(qualityPercent)}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="divide-y p-4">
        {/* Base Points */}
        <BreakdownRow
          icon={<FileText className="h-4 w-4" />}
          label="Базовые баллы"
          value={breakdown.base_points}
          active={breakdown.base_points > 0}
        />

        {/* Length Bonus */}
        <BreakdownRow
          icon={<FileText className="h-4 w-4" />}
          label={`Длина: ${LENGTH_TIER_LABELS[breakdown.length_tier]}`}
          value={breakdown.length_bonus}
          active={breakdown.length_bonus > 0}
          hint={`${wordCount} слов. Напишите ${getNextLengthGoal(wordCount, config)} слов для большего бонуса.`}
        />

        {/* Photo Bonus */}
        <BreakdownRow
          icon={<Camera className="h-4 w-4" />}
          label={`Фото (${photoCount}/${config.photo_max_count})`}
          value={breakdown.photo_bonus}
          active={breakdown.photo_bonus > 0}
          hint={photoCount < config.photo_max_count
            ? `Добавьте фото (+${config.photo_bonus} за каждое, макс. ${config.photo_max_count})`
            : undefined
          }
        />

        {/* Video Bonus */}
        <BreakdownRow
          icon={<Video className="h-4 w-4" />}
          label="Видео"
          value={breakdown.video_bonus}
          active={breakdown.video_bonus > 0}
          hint={videoCount === 0
            ? `Добавьте видео (+${config.video_bonus} баллов)`
            : undefined
          }
        />

        {/* Verified Purchase */}
        <BreakdownRow
          icon={<CheckCircle className="h-4 w-4" />}
          label="Подтверждённая покупка"
          value={breakdown.verified_bonus}
          active={breakdown.verified_bonus > 0}
          hint={!isVerifiedPurchase
            ? 'Отзывы к покупкам получают бонус'
            : undefined
          }
        />
      </div>

      {/* Tips */}
      {breakdown.total_points < 50 && (
        <div className="border-t bg-muted/50 p-4">
          <div className="flex gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-blue-500" />
            <p>
              {getTip(breakdown, config)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface BreakdownRowProps {
  icon: React.ReactNode
  label: string
  value: number
  active: boolean
  hint?: string
}

function BreakdownRow({ icon, label, value, active, hint }: BreakdownRowProps) {
  const row = (
    <div className={`flex items-center justify-between py-2 ${active ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-2">
        <span className={active ? 'text-primary' : 'text-muted-foreground'}>
          {icon}
        </span>
        <span className={`text-sm ${active ? '' : 'text-muted-foreground'}`}>
          {label}
        </span>
        {hint && !active && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">{hint}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span className={`font-medium ${active ? 'text-green-600' : 'text-muted-foreground'}`}>
        {active ? `+${value}` : '—'}
      </span>
    </div>
  )

  return row
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getLevelDescription(score: number): string {
  if (score >= 80) return 'Отличный отзыв! Максимальные баллы.'
  if (score >= 60) return 'Хороший отзыв. Добавьте деталей для большего бонуса.'
  if (score >= 40) return 'Неплохо. Добавьте фото и напишите подробнее.'
  if (score >= 20) return 'Базовый отзыв. Расширьте текст для баллов.'
  return 'Напишите больше текста, чтобы получить баллы.'
}

function getNextLengthGoal(wordCount: number, config: ReviewQualityConfig): string {
  if (wordCount < config.words_tier_1) return config.words_tier_1.toString()
  if (wordCount < config.words_tier_2) return config.words_tier_2.toString()
  if (wordCount < config.words_tier_3) return config.words_tier_3.toString()
  return 'достаточно'
}

function getTip(breakdown: ReviewQualityBreakdown, config: ReviewQualityConfig): string {
  if (breakdown.word_count < config.min_words_for_points) {
    return `Напишите минимум ${config.min_words_for_points} слов, чтобы получить баллы.`
  }
  if (breakdown.photo_count === 0) {
    return 'Добавьте фото вашего опыта для дополнительных баллов.'
  }
  if (breakdown.word_count < config.words_tier_2) {
    return 'Расскажите подробнее о вашем опыте для большего бонуса.'
  }
  return 'Продолжайте в том же духе!'
}

export default PointsCalculator
