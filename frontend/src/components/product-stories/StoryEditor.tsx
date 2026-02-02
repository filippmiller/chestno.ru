/**
 * StoryEditor Component
 *
 * Full editor for creating and editing product stories.
 * Includes story metadata, chapter management, and preview.
 */

import { useState, useCallback } from 'react'
import { Plus, Eye, Save, Send, ArrowLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChapterEditor } from './ChapterEditor'
import { StoryViewer } from './StoryViewer'
import type {
  ProductStory,
  ProductStoryCreate,
  ProductStoryUpdate,
  StoryChapter,
  StoryChapterCreate,
  StoryStatus,
} from '@/types/product-stories'

export interface StoryEditorProps {
  /** Existing story (for editing) */
  story?: ProductStory
  /** Organization ID */
  organizationId: string
  /** Available products to select from */
  products: Array<{ id: string; name: string; slug: string; image?: string }>
  /** Save handler */
  onSave: (data: ProductStoryCreate | ProductStoryUpdate, chapters: StoryChapterCreate[]) => Promise<void>
  /** Publish handler */
  onPublish?: () => Promise<void>
  /** Cancel/back handler */
  onCancel?: () => void
  /** Is saving */
  isSaving?: boolean
  /** Additional class names */
  className?: string
}

export function StoryEditor({
  story,
  organizationId,
  products,
  onSave,
  onPublish,
  onCancel,
  isSaving = false,
  className,
}: StoryEditorProps) {
  const isEditing = !!story

  // Story metadata state
  const [title, setTitle] = useState(story?.title || '')
  const [description, setDescription] = useState(story?.description || '')
  const [coverImage, setCoverImage] = useState(story?.cover_image || '')
  const [productId, setProductId] = useState(story?.product_id || '')
  const [status, setStatus] = useState<StoryStatus>(story?.status || 'draft')

  // Chapters state
  const [chapters, setChapters] = useState<StoryChapterCreate[]>(
    story?.chapters?.map((ch) => ({
      order_index: ch.order_index,
      title: ch.title,
      content_type: ch.content_type,
      content: ch.content,
      media_url: ch.media_url,
      media_urls: ch.media_urls,
      duration_seconds: ch.duration_seconds,
      quiz_question: ch.quiz_question,
      quiz_options: ch.quiz_options,
      quiz_explanation: ch.quiz_explanation,
      background_color: ch.background_color,
      text_color: ch.text_color,
    })) || []
  )

  // Preview state
  const [showPreview, setShowPreview] = useState(false)

  // Validation
  const isValid = title.trim() && productId && chapters.length > 0

  // Chapter handlers
  const addChapter = () => {
    setChapters((prev) => [
      ...prev,
      {
        order_index: prev.length,
        title: '',
        content_type: 'TEXT',
        content: '',
        duration_seconds: 5,
      },
    ])
  }

  const updateChapter = (index: number, data: StoryChapterCreate) => {
    setChapters((prev) => {
      const updated = [...prev]
      updated[index] = { ...data, order_index: index }
      return updated
    })
  }

  const deleteChapter = (index: number) => {
    setChapters((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((ch, idx) => ({ ...ch, order_index: idx }))
    )
  }

  // Move chapter (for reordering)
  const moveChapter = (fromIndex: number, toIndex: number) => {
    setChapters((prev) => {
      const updated = [...prev]
      const [removed] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, removed)
      return updated.map((ch, idx) => ({ ...ch, order_index: idx }))
    })
  }

  // Save handler
  const handleSave = useCallback(async () => {
    if (isEditing) {
      await onSave(
        {
          title,
          description,
          cover_image: coverImage,
          status,
        },
        chapters
      )
    } else {
      await onSave(
        {
          product_id: productId,
          organization_id: organizationId,
          title,
          description,
          cover_image: coverImage,
        },
        chapters
      )
    }
  }, [isEditing, title, description, coverImage, status, productId, organizationId, chapters, onSave])

  // Preview data
  const previewStory: ProductStory = {
    id: story?.id || 'preview',
    product_id: productId,
    organization_id: organizationId,
    title,
    description,
    cover_image: coverImage,
    status,
    published_at: story?.published_at || null,
    view_count: story?.view_count || 0,
    completion_count: story?.completion_count || 0,
    avg_time_spent_seconds: story?.avg_time_spent_seconds || 0,
    created_at: story?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    product_name: products.find((p) => p.id === productId)?.name,
  }

  const previewChapters: StoryChapter[] = chapters.map((ch, idx) => ({
    id: `chapter_${idx}`,
    story_id: previewStory.id,
    order_index: idx,
    title: ch.title || null,
    content_type: ch.content_type || 'TEXT',
    content: ch.content || null,
    media_url: ch.media_url || null,
    media_urls: ch.media_urls || null,
    duration_seconds: ch.duration_seconds || 5,
    quiz_question: ch.quiz_question || null,
    quiz_options: ch.quiz_options || null,
    quiz_explanation: ch.quiz_explanation || null,
    background_color: ch.background_color || null,
    text_color: ch.text_color || null,
    metadata: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {isEditing ? 'Редактирование истории' : 'Новая история'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing
                ? 'Измените содержимое и настройки истории'
                : 'Создайте увлекательную историю о вашем продукте'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {chapters.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              Предпросмотр
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={!isValid || isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Сохранить
          </Button>
          {isEditing && story?.status === 'draft' && onPublish && (
            <Button onClick={onPublish} disabled={!isValid || isSaving}>
              <Send className="w-4 h-4 mr-2" />
              Опубликовать
            </Button>
          )}
        </div>
      </div>

      {/* Story metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Основная информация</CardTitle>
          <CardDescription>
            Заголовок, описание и обложка истории
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="product">Продукт *</Label>
              <Select
                value={productId}
                onValueChange={setProductId}
                disabled={isEditing}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder="Выберите продукт" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <span className="flex items-center gap-2">
                        {product.image && (
                          <img
                            src={product.image}
                            alt=""
                            className="w-6 h-6 rounded object-cover"
                          />
                        )}
                        {product.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isEditing && (
              <div>
                <Label htmlFor="status">Статус</Label>
                <Select
                  value={status}
                  onValueChange={(value: StoryStatus) => setStatus(value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Черновик</SelectItem>
                    <SelectItem value="published">Опубликовано</SelectItem>
                    <SelectItem value="archived">В архиве</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="title">Заголовок *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите заголовок истории..."
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание истории..."
              maxLength={1000}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="cover">Обложка (URL)</Label>
            <div className="flex gap-2">
              <Input
                id="cover"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
              {coverImage && (
                <div className="w-16 h-16 rounded-lg overflow-hidden border flex-shrink-0">
                  <img
                    src={coverImage}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chapters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Главы истории</CardTitle>
              <CardDescription>
                Добавьте главы с текстом, изображениями, видео или викторинами
              </CardDescription>
            </div>
            <Button onClick={addChapter}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить главу
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {chapters.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">
                История пока пуста. Добавьте первую главу.
              </p>
              <Button variant="outline" onClick={addChapter}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить главу
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {chapters.map((chapter, index) => (
                <ChapterEditor
                  key={index}
                  chapter={chapter}
                  index={index}
                  onChange={(data) => updateChapter(index, data)}
                  onDelete={() => deleteChapter(index)}
                  isDraggable={chapters.length > 1}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview modal */}
      {showPreview && (
        <StoryViewer
          story={previewStory}
          chapters={previewChapters}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

export default StoryEditor
