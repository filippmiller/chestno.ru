/**
 * Moderation Queue Component
 * Queue list with filtering, sorting, and priority display.
 */
import { useState, useEffect, useCallback } from 'react'
import type {
  ModerationQueueItem,
  ModerationQueueFilters,
  ContentType,
  QueueStatus,
  QueueSource,
} from '@/types/moderation'
import { CONTENT_TYPE_LABELS, QUEUE_STATUS_LABELS } from '@/types/moderation'
import { listModerationQueue, assignQueueItem, decideQueueItem } from '@/api/moderationService'
import { ModerationQueueItem as QueueItemCard } from './ModerationQueueItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ModerationQueueProps {
  onItemSelect?: (item: ModerationQueueItem) => void
  selectedItemId?: string
  onRefresh?: () => void
  showBatchActions?: boolean
}

const SOURCE_OPTIONS: { value: QueueSource; label: string }[] = [
  { value: 'auto_flag', label: 'AI-флаг' },
  { value: 'user_report', label: 'Жалоба пользователя' },
  { value: 'new_content', label: 'Новый контент' },
  { value: 'edit', label: 'Изменение' },
  { value: 'appeal', label: 'Апелляция' },
]

const ORDER_OPTIONS = [
  { value: 'priority', label: 'По приоритету' },
  { value: 'created_at', label: 'По дате создания' },
  { value: 'updated_at', label: 'По обновлению' },
]

export function ModerationQueue({
  onItemSelect,
  selectedItemId,
  onRefresh,
  showBatchActions = false,
}: ModerationQueueProps) {
  const [items, setItems] = useState<ModerationQueueItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [filters, setFilters] = useState<ModerationQueueFilters>({
    status: 'pending',
    order_by: 'priority',
    limit: 20,
    offset: 0,
  })

  const loadQueue = useCallback(async () => {
    setLoading(true)
    try {
      const response = await listModerationQueue(filters)
      setItems(response.items)
      setTotal(response.total)
    } catch (err) {
      console.error('Failed to load queue:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const handleFilterChange = (key: keyof ModerationQueueFilters, value: unknown) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      offset: key !== 'offset' ? 0 : (value as number),
    }))
  }

  const handleAssign = async (itemId: string) => {
    try {
      await assignQueueItem(itemId)
      loadQueue()
      onRefresh?.()
    } catch (err) {
      console.error('Failed to assign item:', err)
    }
  }

  const handleQuickApprove = async (itemId: string) => {
    try {
      await decideQueueItem(itemId, { action: 'approve' })
      loadQueue()
      onRefresh?.()
    } catch (err) {
      console.error('Failed to approve item:', err)
    }
  }

  const handleQuickReject = async (itemId: string) => {
    try {
      await decideQueueItem(itemId, { action: 'reject', notes: 'Quick reject' })
      loadQueue()
      onRefresh?.()
    } catch (err) {
      console.error('Failed to reject item:', err)
    }
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const toggleAllSelection = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)))
    }
  }

  const pageCount = Math.ceil(total / (filters.limit || 20))
  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* Status Filter */}
            <div>
              <Label className="text-xs">Статус</Label>
              <Select
                value={filters.status || ''}
                onValueChange={(v) => handleFilterChange('status', v as QueueStatus)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Все</SelectItem>
                  {Object.entries(QUEUE_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content Type Filter */}
            <div>
              <Label className="text-xs">Тип контента</Label>
              <Select
                value={filters.content_type || ''}
                onValueChange={(v) => handleFilterChange('content_type', v as ContentType)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Все</SelectItem>
                  {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Filter */}
            <div>
              <Label className="text-xs">Источник</Label>
              <Select
                value={filters.source || ''}
                onValueChange={(v) => handleFilterChange('source', v as QueueSource)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Все</SelectItem>
                  {SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Min Priority Filter */}
            <div>
              <Label className="text-xs">Мин. приоритет</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0-100"
                value={filters.min_priority || ''}
                onChange={(e) =>
                  handleFilterChange('min_priority', e.target.value ? parseInt(e.target.value) : undefined)
                }
                className="mt-1"
              />
            </div>

            {/* Order By */}
            <div>
              <Label className="text-xs">Сортировка</Label>
              <Select
                value={filters.order_by || 'priority'}
                onValueChange={(v) => handleFilterChange('order_by', v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Actions */}
      {showBatchActions && selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">
            Выбрано: {selectedIds.size}
          </span>
          <Button variant="outline" size="sm">
            Одобрить выбранные
          </Button>
          <Button variant="outline" size="sm">
            Отклонить выбранные
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Снять выделение
          </Button>
        </div>
      )}

      {/* Queue Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBatchActions && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedIds.size === items.length && items.length > 0}
                onCheckedChange={toggleAllSelection}
              />
              <Label htmlFor="select-all" className="text-sm">
                Выбрать все
              </Label>
            </div>
          )}
          <span className="text-sm text-muted-foreground">
            Всего: {total}
          </span>
        </div>

        <Button variant="outline" size="sm" onClick={loadQueue} disabled={loading}>
          Обновить
        </Button>
      </div>

      {/* Queue Items */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Очередь пуста. Отличная работа!
              </p>
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              {showBatchActions && (
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => toggleItemSelection(item.id)}
                  className="mt-4"
                />
              )}
              <div className="flex-1">
                <QueueItemCard
                  item={item}
                  isSelected={selectedItemId === item.id}
                  onSelect={() => onItemSelect?.(item)}
                  onAssign={() => handleAssign(item.id)}
                  onQuickApprove={() => handleQuickApprove(item.id)}
                  onQuickReject={() => handleQuickReject(item.id)}
                  showQuickActions={item.assigned_to !== undefined}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleFilterChange('offset', Math.max(0, (filters.offset || 0) - (filters.limit || 20)))
            }
            disabled={currentPage === 1}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Страница {currentPage} из {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleFilterChange('offset', (filters.offset || 0) + (filters.limit || 20))}
            disabled={currentPage === pageCount}
          >
            Вперед
          </Button>
        </div>
      )}
    </div>
  )
}
