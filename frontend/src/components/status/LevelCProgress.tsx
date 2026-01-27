import { Check, X } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { NextLevelProgress } from '@/types/auth'

interface LevelCProgressProps {
  progress: NextLevelProgress
  className?: string
}

export const LevelCProgress = ({ progress, className }: LevelCProgressProps) => {
  const formatValue = (value: number | boolean | string, isPercent?: boolean) => {
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
    if (typeof value === 'number' && isPercent) return `${value}%`
    return String(value)
  }

  const getProgressPercent = (criterion: NextLevelProgress['criteria'][0]) => {
    if (criterion.progress_percent !== undefined) {
      return criterion.progress_percent
    }

    // Calculate progress if numeric
    if (typeof criterion.current_value === 'number' && typeof criterion.required_value === 'number') {
      return Math.min(100, (criterion.current_value / criterion.required_value) * 100)
    }

    return criterion.is_met ? 100 : 0
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Прогресс к уровню {progress.next_level}</CardTitle>
        <CardDescription>
          Общий прогресс: {Math.round(progress.overall_progress_percent)}%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress.overall_progress_percent} className="h-3" />
          <p className="text-sm text-muted-foreground text-right">
            {progress.criteria.filter((c) => c.is_met).length} из {progress.criteria.length} критериев выполнено
          </p>
        </div>

        {/* Individual Criteria */}
        <div className="space-y-4">
          {progress.criteria.map((criterion, index) => {
            const progressPercent = getProgressPercent(criterion)
            const isPercentValue = criterion.key.includes('rate') || criterion.key.includes('percent')

            return (
              <div key={index} className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2 flex-1">
                    <div className="mt-0.5">
                      {criterion.is_met ? (
                        <Check className="h-5 w-5 text-green-600" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{criterion.label}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span>
                          {formatValue(criterion.current_value, isPercentValue)} /{' '}
                          {formatValue(criterion.required_value, isPercentValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress bar for numeric criteria */}
                {typeof criterion.current_value === 'number' && (
                  <Progress value={progressPercent} className="h-2" />
                )}
              </div>
            )
          })}
        </div>

        {/* Eligibility Status */}
        {progress.is_eligible ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-900">
              Вы соответствуете всем требованиям уровня {progress.next_level}!
            </p>
            <p className="text-xs text-green-700 mt-1">Вы можете подать заявку на повышение статуса.</p>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              Продолжайте работать над выполнением критериев для получения уровня {progress.next_level}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
