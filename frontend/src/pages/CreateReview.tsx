import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Star } from 'lucide-react'

import { fetchPublicOrganizationDetailsById } from '@/api/authService'
import { createPublicReviewById } from '@/api/reviewsService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUserStore } from '@/store/userStore'
import type { PublicOrganizationDetails } from '@/types/auth'
import type { ReviewCreate } from '@/types/reviews'

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  body: z.string().min(10, 'Отзыв должен содержать минимум 10 символов'),
})

export const CreateReviewPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useUserStore()
  const [organization, setOrganization] = useState<PublicOrganizationDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const onSubmit = async (values: z.infer<typeof reviewSchema>) => {
    if (!id) return

    setSubmitting(true)
    setError(null)

    try {
      const payload: ReviewCreate = {
        rating: values.rating,
        title: values.title || undefined,
        body: values.body,
        media: [], // TODO: добавить загрузку медиа
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

