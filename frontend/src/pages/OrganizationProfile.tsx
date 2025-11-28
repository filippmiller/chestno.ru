import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { getOrganizationProfile, upsertOrganizationProfile } from '@/api/authService'
import { MediaUploader } from '@/components/MediaUploader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUserStore } from '@/store/userStore'

const profileSchema = z.object({
  short_description: z.string().max(500, 'Максимум 500 символов').optional().or(z.literal('').transform(() => undefined)),
  long_description: z.string().optional(),
  production_description: z.string().optional(),
  safety_and_quality: z.string().optional(),
  video_url: z.string().url('Введите корректный URL').optional().or(z.literal('').transform(() => undefined)),
  tags: z.string().optional(),
  language: z.string().default('ru'),
  galleryInput: z.string().optional(),
  // Contacts
  contact_email: z.string().email('Неверный email').optional().or(z.literal('').transform(() => undefined)),
  contact_phone: z.string().optional(),
  contact_website: z.string().url('Введите корректный URL').optional().or(z.literal('').transform(() => undefined)),
  contact_address: z.string().optional(),
  contact_telegram: z.string().optional(),
  contact_whatsapp: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

const PROFILE_EDIT_ROLES = new Set(['owner', 'admin', 'manager', 'editor'])

export const OrganizationProfilePage = () => {
  const { organizations, memberships, selectedOrganizationId, setSelectedOrganization } = useUserStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [mainImageUrl, setMainImageUrl] = useState<string | null>(null)
  const [gallery, setGallery] = useState<Array<{ url: string; caption?: string | null }>>([])

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      short_description: '',
      long_description: '',
      production_description: '',
      safety_and_quality: '',
      video_url: '',
      tags: '',
      language: 'ru',
      galleryInput: '',
      contact_email: '',
      contact_phone: '',
      contact_website: '',
      contact_address: '',
      contact_telegram: '',
      contact_whatsapp: '',
    },
  })

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )
  const membership = memberships.find((m) => m.organization_id === selectedOrganization?.id)
  const canEdit = membership ? PROFILE_EDIT_ROLES.has(membership.role) : false

  const organizationId = selectedOrganization?.id

  useEffect(() => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    getOrganizationProfile(organizationId)
      .then((profile) => {
        form.reset({
          short_description: profile?.short_description ?? '',
          long_description: profile?.long_description ?? '',
          production_description: profile?.production_description ?? '',
          safety_and_quality: profile?.safety_and_quality ?? '',
          video_url: profile?.video_url ?? '',
          tags: profile?.tags ?? '',
          language: profile?.language ?? 'ru',
          galleryInput: profile?.gallery
            ? profile.gallery.map((item) => (item.caption ? `${item.url} | ${item.caption}` : item.url)).join('\n')
            : '',
          contact_email: profile?.contact_email ?? '',
          contact_phone: profile?.contact_phone ?? '',
          contact_website: profile?.contact_website ?? '',
          contact_address: profile?.contact_address ?? '',
          contact_telegram: profile?.contact_telegram ?? '',
          contact_whatsapp: profile?.contact_whatsapp ?? '',
        })
        setMainImageUrl(profile?.gallery?.[0]?.url || null)
        setGallery(profile?.gallery || [])
      })
      .catch((err) => {
        console.error(err)
        setError('Не удалось загрузить профиль организации')
      })
      .finally(() => setLoading(false))
  }, [organizationId, form])

  const onSubmit = async (values: ProfileFormValues) => {
    if (!organizationId || !selectedOrganization) return
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      // gallery уже в состоянии
      await upsertOrganizationProfile(organizationId, {
        short_description: values.short_description,
        long_description: values.long_description,
        production_description: values.production_description,
        safety_and_quality: values.safety_and_quality,
        video_url: values.video_url,
        tags: values.tags,
        language: values.language,
        gallery,
        contact_email: values.contact_email,
        contact_phone: values.contact_phone,
        contact_website: values.contact_website,
        contact_address: values.contact_address,
        contact_telegram: values.contact_telegram,
        contact_whatsapp: values.contact_whatsapp,
      })
      setSuccessMessage('Профиль обновлён')
    } catch (err) {
      console.error(err)
      setError('Не удалось сохранить профиль. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  if (!selectedOrganization) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
        <Alert>
          <AlertTitle>Нет организаций</AlertTitle>
          <AlertDescription>Чтобы заполнить профиль, сначала создайте организацию или примите приглашение.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!membership) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Нет доступа</AlertTitle>
          <AlertDescription>Похоже, вы ещё не состоите в этой организации. Обратитесь к администратору.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Профиль организации</h1>
        <p className="text-muted-foreground">
          Обновляйте информацию о производстве. Эти данные увидят пользователи по QR-коду и на витрине бренда.
        </p>
      </div>

      {organizations.length > 1 && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Выберите организацию</p>
          <select
            value={selectedOrganization.id}
            onChange={(event) => setSelectedOrganization(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert>
          <AlertTitle>Сохранено</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{selectedOrganization.name}</CardTitle>
          <CardDescription>
            Роль: <span className="font-medium">{membership.role}</span>.{' '}
            {canEdit ? 'Вы можете редактировать профиль.' : 'У вас доступ только для просмотра.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="short_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Короткое описание</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Кратко о производстве" disabled={!canEdit || loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="long_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>История бренда</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Расскажите подробнее" rows={6} disabled={!canEdit || loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="production_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Как работает производство</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Материалы, процессы, технологии" rows={4} disabled={!canEdit || loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="safety_and_quality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Безопасность и качество</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Сертификаты, стандарты, экология" rows={4} disabled={!canEdit || loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <FormLabel>Главное фото</FormLabel>
                {organizationId && (
                  <MediaUploader
                    type="profile-image"
                    organizationId={organizationId}
                    onUploadComplete={(url) => {
                      setMainImageUrl(url)
                      if (gallery.length === 0) {
                        setGallery([{ url, caption: 'Главное фото' }])
                      } else {
                        setGallery([{ url, caption: 'Главное фото' }, ...gallery.slice(1)])
                      }
                    }}
                    maxFiles={1}
                  />
                )}
                {mainImageUrl && (
                  <img src={mainImageUrl} alt="Main" className="mt-2 h-32 w-32 rounded object-cover" />
                )}
              </div>

              <div>
                <FormLabel>Галерея фотографий</FormLabel>
                {organizationId && (
                  <MediaUploader
                    type="profile-gallery"
                    organizationId={organizationId}
                    onUploadComplete={(url) => {
                      setGallery([...gallery, { url }])
                    }}
                    maxFiles={50}
                  />
                )}
                {gallery.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {gallery.map((item, idx) => (
                      <div key={idx} className="relative">
                        <img src={item.url} alt={item.caption || `Photo ${idx + 1}`} className="h-20 w-full rounded object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Теги (через запятую)</FormLabel>
                      <FormControl>
                        <Input placeholder="био, локально, ферма" disabled={!canEdit || loading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Язык</FormLabel>
                      <FormControl>
                        <Input placeholder="ru" disabled={!canEdit || loading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="mb-4 text-lg font-semibold">Контакты</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="contact@example.com" disabled={!canEdit || loading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contact_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Телефон</FormLabel>
                        <FormControl>
                          <Input placeholder="+7 (999) 123-45-67" disabled={!canEdit || loading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contact_website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Сайт</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com" disabled={!canEdit || loading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contact_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Адрес</FormLabel>
                        <FormControl>
                          <Input placeholder="Город, улица, дом" disabled={!canEdit || loading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contact_telegram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telegram</FormLabel>
                        <FormControl>
                          <Input placeholder="@username" disabled={!canEdit || loading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contact_whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="+7 (999) 123-45-67" disabled={!canEdit || loading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {canEdit && (
                <Button type="submit" disabled={loading}>
                  {loading ? 'Сохраняем...' : 'Сохранить'}
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

