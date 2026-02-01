/**
 * AI Pattern Manager
 * Admin UI for managing AI moderation patterns.
 */
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  listAIPatterns,
  createAIPattern,
  updateAIPattern,
  deleteAIPattern,
  toggleAIPatternStatus,
  type AIPattern,
  type AIPatternCreate,
} from '@/api/moderationService'

const PATTERN_TYPES = [
  { value: 'text_keywords', label: 'Ключевые слова', description: 'Поиск по ключевым словам' },
  { value: 'text_regex', label: 'Регулярное выражение', description: 'Поиск по regex-паттерну' },
  { value: 'behavioral', label: 'Поведенческий', description: 'Анализ поведения (например, всплеск отзывов)' },
  { value: 'image_hash', label: 'Хеш изображения', description: 'Perceptual hashing для дубликатов изображений' },
  { value: 'document_fingerprint', label: 'Отпечаток документа', description: 'Проверка подлинности документов' },
]

const ACTION_OPTIONS = [
  { value: 'flag', label: 'Флаг для проверки', description: 'Добавить в очередь модерации' },
  { value: 'auto_reject', label: 'Авто-отклонение', description: 'Автоматически отклонить контент' },
  { value: 'shadow_ban', label: 'Теневой бан', description: 'Скрытое ограничение видимости' },
]

interface PatternFormData {
  pattern_type: AIPattern['pattern_type']
  name: string
  description: string
  detects: string
  action: AIPattern['action']
  priority_boost: number
  pattern_config: string // JSON string for editing
}

const emptyFormData: PatternFormData = {
  pattern_type: 'text_keywords',
  name: '',
  description: '',
  detects: '',
  action: 'flag',
  priority_boost: 10,
  pattern_config: '{}',
}

export function AIPatternManager() {
  const [patterns, setPatterns] = useState<AIPattern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingPattern, setEditingPattern] = useState<AIPattern | null>(null)
  const [deletingPatternId, setDeletingPatternId] = useState<string | null>(null)
  const [formData, setFormData] = useState<PatternFormData>(emptyFormData)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPatterns()
  }, [])

  async function loadPatterns() {
    setLoading(true)
    setError(null)
    try {
      const data = await listAIPatterns()
      setPatterns(data)
    } catch (err) {
      console.error('Failed to load patterns:', err)
      setError('Не удалось загрузить паттерны')
    } finally {
      setLoading(false)
    }
  }

  const openCreateDialog = () => {
    setEditingPattern(null)
    setFormData(emptyFormData)
    setShowEditDialog(true)
  }

  const openEditDialog = (pattern: AIPattern) => {
    setEditingPattern(pattern)
    setFormData({
      pattern_type: pattern.pattern_type,
      name: pattern.name,
      description: pattern.description || '',
      detects: pattern.detects,
      action: pattern.action,
      priority_boost: pattern.priority_boost,
      pattern_config: JSON.stringify(pattern.pattern_config, null, 2),
    })
    setShowEditDialog(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      let parsedConfig: Record<string, unknown>
      try {
        parsedConfig = JSON.parse(formData.pattern_config)
      } catch {
        setError('Неверный JSON в конфигурации паттерна')
        setSaving(false)
        return
      }

      if (editingPattern) {
        // Update existing
        await updateAIPattern(editingPattern.id, {
          name: formData.name,
          description: formData.description || undefined,
          detects: formData.detects,
          action: formData.action,
          priority_boost: formData.priority_boost,
          pattern_config: parsedConfig,
        })
      } else {
        // Create new
        const newPattern: AIPatternCreate = {
          pattern_type: formData.pattern_type,
          name: formData.name,
          description: formData.description || undefined,
          detects: formData.detects,
          action: formData.action,
          priority_boost: formData.priority_boost,
          pattern_config: parsedConfig,
        }
        await createAIPattern(newPattern)
      }

      setShowEditDialog(false)
      loadPatterns()
    } catch (err) {
      console.error('Failed to save pattern:', err)
      setError('Не удалось сохранить паттерн')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingPatternId) return

    try {
      await deleteAIPattern(deletingPatternId)
      setShowDeleteDialog(false)
      setDeletingPatternId(null)
      loadPatterns()
    } catch (err) {
      console.error('Failed to delete pattern:', err)
      setError('Не удалось удалить паттерн')
    }
  }

  const handleToggleStatus = async (pattern: AIPattern) => {
    try {
      await toggleAIPatternStatus(pattern.id, !pattern.is_active)
      loadPatterns()
    } catch (err) {
      console.error('Failed to toggle pattern status:', err)
      setError('Не удалось изменить статус')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Паттерны модерации</h2>
          <p className="text-muted-foreground">
            Управление автоматическими правилами обнаружения нарушений
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить паттерн
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Patterns List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : patterns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Нет настроенных паттернов</p>
            <Button onClick={openCreateDialog}>Создать первый паттерн</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {patterns.map((pattern) => (
            <Card key={pattern.id} className={!pattern.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{pattern.name}</CardTitle>
                    <CardDescription>{pattern.description || 'Нет описания'}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleStatus(pattern)}
                      title={pattern.is_active ? 'Деактивировать' : 'Активировать'}
                    >
                      {pattern.is_active ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(pattern)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingPatternId(pattern.id)
                        setShowDeleteDialog(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline">
                    {PATTERN_TYPES.find((t) => t.value === pattern.pattern_type)?.label || pattern.pattern_type}
                  </Badge>
                  <Badge
                    variant={
                      pattern.action === 'auto_reject'
                        ? 'destructive'
                        : pattern.action === 'shadow_ban'
                        ? 'secondary'
                        : 'default'
                    }
                  >
                    {ACTION_OPTIONS.find((a) => a.value === pattern.action)?.label || pattern.action}
                  </Badge>
                  <Badge variant="outline">+{pattern.priority_boost} приоритет</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Обнаруживает: {pattern.detects}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPattern ? 'Редактировать паттерн' : 'Новый паттерн'}
            </DialogTitle>
            <DialogDescription>
              Настройте правило автоматического обнаружения нарушений
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Pattern Type (only for new) */}
            {!editingPattern && (
              <div>
                <Label>Тип паттерна</Label>
                <Select
                  value={formData.pattern_type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, pattern_type: v as AIPattern['pattern_type'] })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PATTERN_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <span className="font-medium">{type.label}</span>
                          <p className="text-xs text-muted-foreground">{type.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Name */}
            <div>
              <Label htmlFor="pattern-name">Название</Label>
              <Input
                id="pattern-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Ключевые слова о здоровье"
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="pattern-desc">Описание</Label>
              <Textarea
                id="pattern-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Краткое описание того, что обнаруживает этот паттерн"
                rows={2}
                className="mt-1"
              />
            </div>

            {/* Detects */}
            <div>
              <Label htmlFor="pattern-detects">Что обнаруживает</Label>
              <Input
                id="pattern-detects"
                value={formData.detects}
                onChange={(e) => setFormData({ ...formData, detects: e.target.value })}
                placeholder="Например: Вводящие в заблуждение заявления о здоровье"
                className="mt-1"
              />
            </div>

            {/* Action */}
            <div>
              <Label>Действие при обнаружении</Label>
              <Select
                value={formData.action}
                onValueChange={(v) => setFormData({ ...formData, action: v as AIPattern['action'] })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      <div>
                        <span className="font-medium">{action.label}</span>
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Boost */}
            <div>
              <Label htmlFor="pattern-priority">Бонус к приоритету (0-50)</Label>
              <Input
                id="pattern-priority"
                type="number"
                min={0}
                max={50}
                value={formData.priority_boost}
                onChange={(e) =>
                  setFormData({ ...formData, priority_boost: parseInt(e.target.value) || 0 })
                }
                className="mt-1 w-32"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Добавляется к базовому приоритету при обнаружении
              </p>
            </div>

            {/* Pattern Config (JSON) */}
            <div>
              <Label htmlFor="pattern-config">Конфигурация (JSON)</Label>
              <Textarea
                id="pattern-config"
                value={formData.pattern_config}
                onChange={(e) => setFormData({ ...formData, pattern_config: e.target.value })}
                placeholder='{"keywords": ["слово1", "слово2"]}'
                rows={6}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Формат зависит от типа паттерна. Для text_keywords: {`{"keywords": [...], "fuzzy": true}`}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name || !formData.detects}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить паттерн?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Паттерн будет полностью удален.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
