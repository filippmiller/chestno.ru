import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { StatusHistoryEntry } from '@/types/auth'

interface StatusHistoryProps {
  entries: StatusHistoryEntry[]
  total: number
  limit: number
  offset: number
  onPageChange: (offset: number) => void
  loading?: boolean
  className?: string
}

const ACTION_CONFIG = {
  granted: { label: 'Присвоен', color: 'bg-green-100 text-green-800' },
  revoked: { label: 'Отозван', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Истёк', color: 'bg-gray-100 text-gray-800' },
  upgraded: { label: 'Повышен', color: 'bg-blue-100 text-blue-800' },
  downgraded: { label: 'Понижен', color: 'bg-yellow-100 text-yellow-800' },
} as const

const LEVEL_CONFIG = {
  A: { color: 'bg-gray-500' },
  B: { color: 'bg-blue-500' },
  C: { color: 'bg-green-500' },
} as const

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const StatusHistory = ({
  entries,
  total,
  limit,
  offset,
  onPageChange,
  loading,
  className,
}: StatusHistoryProps) => {
  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  const handlePrevPage = () => {
    if (offset > 0) {
      onPageChange(Math.max(0, offset - limit))
    }
  }

  const handleNextPage = () => {
    if (offset + limit < total) {
      onPageChange(offset + limit)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>История изменений статуса</CardTitle>
        <CardDescription>Все изменения статуса организации</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">История пуста</div>
        ) : (
          <div className="space-y-4">
            {/* Timeline */}
            <div className="relative space-y-6">
              {entries.map((entry, index) => {
                const actionConfig = ACTION_CONFIG[entry.action]
                const levelConfig = LEVEL_CONFIG[entry.level]

                return (
                  <div key={entry.id} className="relative pl-8">
                    {/* Timeline line */}
                    {index < entries.length - 1 && (
                      <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-gray-200" />
                    )}

                    {/* Timeline dot */}
                    <div className="absolute left-0 top-2 w-4 h-4 rounded-full bg-white border-2 border-gray-300" />

                    {/* Entry content */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${levelConfig.color} text-white`}>Уровень {entry.level}</Badge>
                        <Badge variant="outline" className={actionConfig.color}>
                          {actionConfig.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{formatDateTime(entry.performed_at)}</span>
                      </div>

                      {entry.reason && <p className="text-sm text-muted-foreground">{entry.reason}</p>}

                      {entry.performed_by && (
                        <p className="text-xs text-muted-foreground">Выполнено: {entry.performed_by}</p>
                      )}

                      {(entry.valid_from || entry.valid_until) && (
                        <div className="text-xs text-muted-foreground">
                          {entry.valid_from && <span>С: {formatDateTime(entry.valid_from)}</span>}
                          {entry.valid_from && entry.valid_until && <span className="mx-2">•</span>}
                          {entry.valid_until && <span>До: {formatDateTime(entry.valid_until)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Страница {currentPage} из {totalPages} (всего: {total})
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={offset === 0 || loading}>
                    <ChevronLeft className="h-4 w-4" />
                    Назад
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={offset + limit >= total || loading}
                  >
                    Вперёд
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
