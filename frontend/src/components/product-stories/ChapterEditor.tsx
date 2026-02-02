/**
 * ChapterEditor Component
 *
 * Editor for a single story chapter. Supports all content types
 * with appropriate form fields and previews.
 */

import { useState, useEffect } from 'react'
import { GripVertical, Trash2, Image, Video, Images, HelpCircle, Type, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { StoryChapter, StoryChapterCreate, StoryContentType, QuizOption } from '@/types/product-stories'

export interface ChapterEditorProps {
  /** Chapter data (for editing) */
  chapter?: StoryChapter | StoryChapterCreate
  /** Chapter index */
  index: number
  /** Change handler */
  onChange: (data: StoryChapterCreate) => void
  /** Delete handler */
  onDelete?: () => void
  /** Whether reordering is possible */
  isDraggable?: boolean
  /** Additional class names */
  className?: string
}

const contentTypeIcons: Record<StoryContentType, React.ReactNode> = {
  TEXT: <Type className="w-4 h-4" />,
  IMAGE: <Image className="w-4 h-4" />,
  VIDEO: <Video className="w-4 h-4" />,
  GALLERY: <Images className="w-4 h-4" />,
  QUIZ: <HelpCircle className="w-4 h-4" />,
}

const contentTypeLabels: Record<StoryContentType, string> = {
  TEXT: 'Текст',
  IMAGE: 'Изображение',
  VIDEO: 'Видео',
  GALLERY: 'Галерея',
  QUIZ: 'Викторина',
}

export function ChapterEditor({
  chapter,
  index,
  onChange,
  onDelete,
  isDraggable = true,
  className,
}: ChapterEditorProps) {
  const [localData, setLocalData] = useState<StoryChapterCreate>({
    order_index: index,
    title: '',
    content_type: 'TEXT',
    content: '',
    media_url: '',
    media_urls: [],
    duration_seconds: 5,
    quiz_question: '',
    quiz_options: [],
    quiz_explanation: '',
    background_color: '',
    text_color: '',
    ...chapter,
  })

  // Sync with parent when chapter prop changes
  useEffect(() => {
    if (chapter) {
      setLocalData({
        order_index: index,
        ...chapter,
      })
    }
  }, [chapter, index])

  // Update handler
  const updateField = <K extends keyof StoryChapterCreate>(
    field: K,
    value: StoryChapterCreate[K]
  ) => {
    const updated = { ...localData, [field]: value }
    setLocalData(updated)
    onChange(updated)
  }

  // Quiz option handlers
  const addQuizOption = () => {
    const options = localData.quiz_options || []
    const newOption: QuizOption = {
      id: `opt_${Date.now()}`,
      text: '',
      is_correct: options.length === 0, // First option is correct by default
    }
    updateField('quiz_options', [...options, newOption])
  }

  const updateQuizOption = (optionIndex: number, updates: Partial<QuizOption>) => {
    const options = [...(localData.quiz_options || [])]
    options[optionIndex] = { ...options[optionIndex], ...updates }

    // If setting correct, unset others
    if (updates.is_correct) {
      options.forEach((opt, idx) => {
        if (idx !== optionIndex) {
          opt.is_correct = false
        }
      })
    }

    updateField('quiz_options', options)
  }

  const removeQuizOption = (optionIndex: number) => {
    const options = (localData.quiz_options || []).filter((_, idx) => idx !== optionIndex)
    updateField('quiz_options', options)
  }

  // Gallery URL handlers
  const addGalleryUrl = () => {
    const urls = localData.media_urls || []
    updateField('media_urls', [...urls, ''])
  }

  const updateGalleryUrl = (urlIndex: number, value: string) => {
    const urls = [...(localData.media_urls || [])]
    urls[urlIndex] = value
    updateField('media_urls', urls)
  }

  const removeGalleryUrl = (urlIndex: number) => {
    const urls = (localData.media_urls || []).filter((_, idx) => idx !== urlIndex)
    updateField('media_urls', urls)
  }

  return (
    <Card className={cn('relative', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {/* Drag handle */}
          {isDraggable && (
            <div className="cursor-grab text-muted-foreground hover:text-foreground">
              <GripVertical className="w-5 h-5" />
            </div>
          )}

          {/* Chapter number */}
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
            {index + 1}
          </div>

          {/* Content type selector */}
          <Select
            value={localData.content_type}
            onValueChange={(value: StoryContentType) => updateField('content_type', value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(contentTypeLabels) as StoryContentType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  <span className="flex items-center gap-2">
                    {contentTypeIcons[type]}
                    {contentTypeLabels[type]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Title input */}
          <Input
            value={localData.title || ''}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Заголовок (опционально)"
            className="flex-1"
          />

          {/* Delete button */}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* TEXT content */}
        {localData.content_type === 'TEXT' && (
          <div className="space-y-4">
            <div>
              <Label>Содержание</Label>
              <Textarea
                value={localData.content || ''}
                onChange={(e) => updateField('content', e.target.value)}
                placeholder="Введите текст..."
                rows={4}
              />
            </div>
          </div>
        )}

        {/* IMAGE content */}
        {localData.content_type === 'IMAGE' && (
          <div className="space-y-4">
            <div>
              <Label>URL изображения</Label>
              <Input
                value={localData.media_url || ''}
                onChange={(e) => updateField('media_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            {localData.media_url && (
              <div className="rounded-lg overflow-hidden border">
                <img
                  src={localData.media_url}
                  alt="Preview"
                  className="max-h-40 w-full object-contain bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-image.png'
                  }}
                />
              </div>
            )}
            <div>
              <Label>Подпись (опционально)</Label>
              <Textarea
                value={localData.content || ''}
                onChange={(e) => updateField('content', e.target.value)}
                placeholder="Подпись к изображению..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* VIDEO content */}
        {localData.content_type === 'VIDEO' && (
          <div className="space-y-4">
            <div>
              <Label>URL видео</Label>
              <Input
                value={localData.media_url || ''}
                onChange={(e) => updateField('media_url', e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Поддерживаются MP4 и WebM форматы
              </p>
            </div>
            {localData.media_url && (
              <div className="rounded-lg overflow-hidden border">
                <video
                  src={localData.media_url}
                  controls
                  className="max-h-40 w-full"
                />
              </div>
            )}
            <div>
              <Label>Подпись (опционально)</Label>
              <Textarea
                value={localData.content || ''}
                onChange={(e) => updateField('content', e.target.value)}
                placeholder="Подпись к видео..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* GALLERY content */}
        {localData.content_type === 'GALLERY' && (
          <div className="space-y-4">
            <div>
              <Label>Изображения галереи</Label>
              <div className="space-y-2 mt-2">
                {(localData.media_urls || []).map((url, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={url}
                      onChange={(e) => updateGalleryUrl(idx, e.target.value)}
                      placeholder={`URL изображения ${idx + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGalleryUrl(idx)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addGalleryUrl}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить изображение
                </Button>
              </div>
            </div>
            {(localData.media_urls || []).length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {localData.media_urls?.map((url, idx) => (
                  url && (
                    <img
                      key={idx}
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* QUIZ content */}
        {localData.content_type === 'QUIZ' && (
          <div className="space-y-4">
            <div>
              <Label>Вопрос</Label>
              <Textarea
                value={localData.quiz_question || ''}
                onChange={(e) => updateField('quiz_question', e.target.value)}
                placeholder="Введите вопрос..."
                rows={2}
              />
            </div>

            <div>
              <Label>Варианты ответов</Label>
              <div className="space-y-2 mt-2">
                {(localData.quiz_options || []).map((option, idx) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={option.is_correct}
                      onChange={() => updateQuizOption(idx, { is_correct: true })}
                      className="w-4 h-4"
                    />
                    <Input
                      value={option.text}
                      onChange={(e) => updateQuizOption(idx, { text: e.target.value })}
                      placeholder={`Вариант ${idx + 1}`}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuizOption(idx)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addQuizOption}
                  className="w-full"
                  disabled={(localData.quiz_options || []).length >= 4}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить вариант
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Выберите правильный ответ (радиокнопка)
              </p>
            </div>

            <div>
              <Label>Пояснение (показывается после ответа)</Label>
              <Textarea
                value={localData.quiz_explanation || ''}
                onChange={(e) => updateField('quiz_explanation', e.target.value)}
                placeholder="Пояснение к правильному ответу..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Common settings */}
        <div className="flex gap-4 pt-4 border-t">
          <div className="flex-1">
            <Label>Длительность (сек)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={localData.duration_seconds}
              onChange={(e) => updateField('duration_seconds', parseInt(e.target.value) || 5)}
              className="w-24"
            />
          </div>
          <div className="flex-1">
            <Label>Цвет фона</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={localData.background_color || '#000000'}
                onChange={(e) => updateField('background_color', e.target.value)}
                className="w-12 h-10 p-1"
              />
              <Input
                value={localData.background_color || ''}
                onChange={(e) => updateField('background_color', e.target.value)}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>
          <div className="flex-1">
            <Label>Цвет текста</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={localData.text_color || '#ffffff'}
                onChange={(e) => updateField('text_color', e.target.value)}
                className="w-12 h-10 p-1"
              />
              <Input
                value={localData.text_color || ''}
                onChange={(e) => updateField('text_color', e.target.value)}
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ChapterEditor
