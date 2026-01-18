import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Save, Plus, Trash2 } from 'lucide-react'

import {
  getOrganizationPost,
  createOrganizationPost,
  updateOrganizationPost,
} from '@/api/postsService'
import type { OrganizationPostCreate, OrganizationPostUpdate } from '@/types/posts'
import { MediaUploader } from '@/components/MediaUploader'
import { RichTextEditor } from '@/components/RichTextEditor'
import { uploadPostImage, validateImageFile } from '@/utils/mediaUploader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useUserStore } from '@/store/userStore'

const postSchema = z.object({
  slug: z.string().min(1, 'Обязательное поле'),
  title: z.string().min(1, 'Обязательное поле'),
  excerpt: z.string().optional(),
  body: z.string().min(1, 'Обязательное поле'),
  status: z.enum(['draft', 'published', 'archived']),
  main_image_url: z.string().optional(),
  video_url: z.string().url('Введите корректный URL').optional().or(z.literal('').transform(() => undefined)),
  is_pinned: z.boolean().default(false),
})

type PostFormValues = z.infer<typeof postSchema>

export const OrganizationPostEditPage = () => {
  const { organizationId, postId } = useParams<{ organizationId: string; postId?: string }>()
  const navigate = useNavigate()
  const { selectedOrganizationId } = useUserStore()
  const orgId = organizationId || selectedOrganizationId

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mainImageUrl, setMainImageUrl] = useState<string | null>(null)
  const [gallery, setGallery] = useState<Array<{ url: string; alt?: string | null; sort_order?: number | null }>>([])

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      slug: '',
      title: '',
      excerpt: '',
      body: '',
      status: 'draft',
      main_image_url: '',
      video_url: '',
      is_pinned: false,
    },
  })

  useEffect(() => {
    if (!orgId || !postId) return

    setLoading(true)
    getOrganizationPost(orgId, postId)
      .then((post) => {
        form.reset({
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt || '',
          body: post.body,
          status: post.status,
          main_image_url: post.main_image_url || '',
          video_url: post.video_url || '',
          is_pinned: post.is_pinned,
        })
        setMainImageUrl(post.main_image_url || null)
        setGallery(post.gallery?.map(item => ({ 
          url: item.url, 
          alt: item.alt ?? undefined, 
          sort_order: item.sort_order ?? undefined 
        })) || [])
      })
      .catch((err) => {
        console.error(err)
        setError('Не удалось загрузить пост')
      })
      .finally(() => setLoading(false))
  }, [orgId, postId, form])

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !orgId) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      setError(validation.error || 'Некорректный файл')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const url = await uploadPostImage(orgId, postId || 'new', file)
      setGallery((prev) => [...prev, { url, alt: '', sort_order: prev.length }])
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить изображение')
    } finally {
      setUploading(false)
    }
  }

  const removeGalleryImage = (index: number) => {
    setGallery((prev) => prev.filter((_, i) => i !== index))
  }

  const updateGalleryAlt = (index: number, alt: string) => {
    setGallery((prev) =>
      prev.map((item, i) => (i === index ? { ...item, alt } : item))
    )
  }

  const onSubmit = async (values: PostFormValues) => {
    if (!orgId) return

    setLoading(true)
    setError(null)

    try {
      const payload: OrganizationPostCreate | OrganizationPostUpdate = {
        ...values,
        main_image_url: mainImageUrl || undefined,
        gallery: gallery.length > 0 ? gallery : undefined,
      }

      if (postId) {
        await updateOrganizationPost(orgId, postId, payload as OrganizationPostUpdate)
      } else {
        await createOrganizationPost(orgId, payload as OrganizationPostCreate)
      }

      navigate(`/dashboard/organization/posts`)
    } catch (err) {
      console.error(err)
      setError('Не удалось сохранить пост')
    } finally {
      setLoading(false)
    }
  }

  if (!orgId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <Alert>
          <AlertDescription>Выберите организацию</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold">{postId ? 'Редактировать пост' : 'Создать пост'}</h1>
        <p className="text-muted-foreground">Создайте новость или публикацию для вашей организации</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug (URL)</FormLabel>
                      <FormControl>
                        <Input placeholder="my-post-slug" disabled={loading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Статус</FormLabel>
                      <FormControl>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          disabled={loading}
                          {...field}
                        >
                          <option value="draft">Черновик</option>
                          <option value="published">Опубликовано</option>
                          <option value="archived">Архив</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Заголовок</FormLabel>
                    <FormControl>
                      <Input placeholder="Заголовок поста" disabled={loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="excerpt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Краткое описание (опционально)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Краткое описание для превью" rows={2} disabled={loading} {...field} />
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
                    <FormLabel>Текст поста</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Полный текст поста"
                        disabled={loading}
                        onImageUpload={async (file) => {
                          return await uploadPostImage(orgId!, postId || 'new', file)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Главное изображение</FormLabel>
                <MediaUploader
                  type="post-image"
                  organizationId={orgId}
                  postId={postId || 'new'}
                  onUploadComplete={(url) => {
                    setMainImageUrl(url)
                    form.setValue('main_image_url', url)
                  }}
                />
                {mainImageUrl && (
                  <img src={mainImageUrl} alt="Main" className="mt-2 h-32 w-32 rounded object-cover" />
                )}
              </div>

              <FormField
                control={form.control}
                name="video_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Видео (URL)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." disabled={loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Галерея изображений</FormLabel>
                <div className="flex flex-wrap gap-3">
                  {gallery.map((item, index) => (
                    <div key={index} className="relative">
                      <img
                        src={item.url}
                        alt={item.alt || `Изображение ${index + 1}`}
                        className="h-24 w-24 rounded-lg border object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -right-2 -top-2 h-6 w-6 rounded-full p-0"
                        onClick={() => removeGalleryImage(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Input
                        placeholder="Подпись"
                        value={item.alt || ''}
                        onChange={(e) => updateGalleryAlt(index, e.target.value)}
                        className="mt-1 h-7 text-xs"
                      />
                    </div>
                  ))}
                  <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleGalleryUpload}
                      disabled={uploading || loading}
                    />
                    <Plus className="h-8 w-8 text-muted-foreground/50" />
                  </label>
                </div>
                {uploading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
              </div>

              <FormField
                control={form.control}
                name="is_pinned"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={loading} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Закрепить пост</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/dashboard/organization/posts')}>
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

