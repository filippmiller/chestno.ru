import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Star, ImagePlus, X, Loader2 } from 'lucide-react'

import { fetchPublicOrganizationDetailsById } from '@/api/authService'
import { createPublicReviewById } from '@/api/reviewsService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUserStore } from '@/store/userStore'
import { uploadReviewMedia, validateImageFile, validateVideoFile } from '@/utils/mediaUploader'
import type { PublicOrganizationDetails } from '@/types/auth'
import type { ReviewCreate, ReviewMediaItem } from '@/types/reviews'

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  body: z.string().min(10, 'Отзыв должен содержать минимум 10 символов'),
})

interface UploadedMedia {
  url: string
  type: 'image' | 'video'
  file?: File
  uploading?: boolean
}

export const CreateReviewPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useUserStore()
  const [organization, setOrganization] = useState<PublicOrganizationDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [media, setMedia] = useState<UploadedMedia[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generate a stable temp ID for uploads (used in file path)
  const tempReviewId = useMemo(() => crypto.randomUUID(), [])

  const form = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 5,
      title: '',
      body: '',
    },
  })

  useEffect(() => {
    if (!user) {
      navigate(`/register?returnUrl=/org/${id}/review`)
      return
    }

    if (!id) return

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPublicOrganizationDetailsById(id)
        setOrganization(data)
      } catch (err) {
        console.error(err)
        setError('Организация не найдена')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, user, navigate])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !id) return

    setUploadingMedia(true)
    setError(null)

    try {
      for (const file of Array.from(files)) {
        // Validate file
        const isVideo = file.type.startsWith('video/')
        const validation = isVideo ? validateVideoFile(file) : validateImageFile(file)

        if (!validation.valid) {
          setError(validation.error || 'Недопустимый файл')
          continue
        }

        // Upload file
        const url = await uploadReviewMedia(id, null, tempReviewId, file)
        setMedia((prev) => [
          ...prev,
          { url, type: isVideo ? 'video' : 'image' },
        ])
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      setError('Ошибка загрузки файла')
    } finally {
      setUploadingMedia(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async (values: z.infer<typeof reviewSchema>) => {
    if (!id) return

    setSubmitting(true)
    setError(null)

    try {
      const mediaItems: ReviewMediaItem[] = media.map((m) => ({
        type: m.type,
        url: m.url,
      }))

      const payload: ReviewCreate = {
        rating: values.rating,
        title: values.title || undefined,
        body: values.body,
        media: mediaItems,
      }

      await createPublicReviewById(id, payload)
      // Редирект на страницу организации
      navigate(`/org/${id}`, { replace: true })
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail || 'Не удалось создать отзыв')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return null // Редирект уже произошел
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Загружаем данные организации...</p>
      </div>
    )
  }

  if (error && !organization) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Оставить отзыв</CardTitle>
          <CardDescription>
            {organization ? `Организация: ${organization.name}` : 'Загрузка...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Оценка</FormLabel>
                    <FormControl>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => field.onChange(star)}
                            className="focus:outline-none"
                          >
                            <Star
                              className={`h-8 w-8 ${
                                star <= field.value
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Заголовок (необязательно)</FormLabel>
                    <FormControl>
                      <Input placeholder="Краткий заголовок отзыва" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Текст отзыва</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Расскажите о вашем опыте взаимодействия с этой организацией..."
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Media Upload Section */}
              <div className="space-y-2">
                <FormLabel>Фото или видео (необязательно)</FormLabel>
                <div className="flex flex-wrap gap-3">
                  {media.map((item, index) => (
                    <div key={index} className="relative">
                      {item.type === 'image' ? (
                        <img
                          src={item.url}
                          alt={`Медиа ${index + 1}`}
                          className="h-24 w-24 rounded-lg object-cover"
                        />
                      ) : (
                        <video
                          src={item.url}
                          className="h-24 w-24 rounded-lg object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {media.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingMedia}
                      className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 disabled:opacity-50"
                    >
                      {uploadingMedia ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  До 5 файлов. Фото: JPEG, PNG, WebP (до 10 МБ). Видео: MP4, WebM (до 3 ГБ).
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Ошибка</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Отправка...' : 'Отправить отзыв'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/org/${id}`)}
                  disabled={submitting}
                >
                  Отмена
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

