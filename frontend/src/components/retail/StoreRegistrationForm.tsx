/**
 * StoreRegistrationForm Component
 *
 * Onboarding form for new retail partners to register their store locations.
 * Includes address, contact info, and optional chain association.
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, MapPin, User, Phone, Mail, Loader2, CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { registerStore } from '@/api/retailService'
import type { RetailStore } from '@/types/retail'

const storeRegistrationSchema = z.object({
  name: z.string().min(2, 'Название магазина должно содержать минимум 2 символа'),
  chain_name: z.string().optional(),
  address: z.string().min(5, 'Введите полный адрес магазина'),
  city: z.string().min(2, 'Введите название города'),
  region: z.string().optional(),
  postal_code: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  manager_name: z.string().optional(),
  manager_email: z.string().email('Введите корректный email').optional().or(z.literal('')),
  manager_phone: z.string().optional(),
})

type StoreRegistrationFormData = z.infer<typeof storeRegistrationSchema>

interface StoreRegistrationFormProps {
  onSuccess?: (store: RetailStore) => void
  onCancel?: () => void
  className?: string
}

export function StoreRegistrationForm({
  onSuccess,
  onCancel,
  className = '',
}: StoreRegistrationFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [registeredStore, setRegisteredStore] = useState<RetailStore | null>(null)

  const form = useForm<StoreRegistrationFormData>({
    resolver: zodResolver(storeRegistrationSchema),
    defaultValues: {
      name: '',
      chain_name: '',
      address: '',
      city: '',
      region: '',
      postal_code: '',
      manager_name: '',
      manager_email: '',
      manager_phone: '',
    },
  })

  const onSubmit = async (data: StoreRegistrationFormData) => {
    setSubmitting(true)
    setError(null)

    try {
      const store = await registerStore({
        name: data.name,
        chain_name: data.chain_name || undefined,
        address: data.address,
        city: data.city,
        region: data.region || undefined,
        postal_code: data.postal_code || undefined,
        latitude: data.latitude,
        longitude: data.longitude,
        manager_name: data.manager_name || undefined,
        manager_email: data.manager_email || undefined,
        manager_phone: data.manager_phone || undefined,
      })

      setRegisteredStore(store)
      setSuccess(true)
      onSuccess?.(store)
    } catch (err) {
      console.error('Store registration failed:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось зарегистрировать магазин. Попробуйте позже.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (success && registeredStore) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold">Магазин зарегистрирован!</h3>
          <p className="mt-2 text-muted-foreground">
            {registeredStore.name} успешно добавлен в систему.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Код магазина: <span className="font-mono font-medium">{registeredStore.store_code}</span>
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => window.location.reload()}>
              Добавить ещё
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Готово
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Регистрация магазина
        </CardTitle>
        <CardDescription>
          Заполните информацию о вашем розничном магазине для подключения к платформе Честно
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Store Information */}
            <div className="space-y-4">
              <h4 className="font-medium">Информация о магазине</h4>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название магазина *</FormLabel>
                      <FormControl>
                        <Input placeholder="Например: Перекресток на Тверской" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="chain_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Сеть магазинов</FormLabel>
                      <FormControl>
                        <Input placeholder="Например: Перекресток" {...field} />
                      </FormControl>
                      <FormDescription>
                        Если магазин входит в сеть
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-medium">
                <MapPin className="h-4 w-4" />
                Адрес
              </h4>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Полный адрес *</FormLabel>
                    <FormControl>
                      <Input placeholder="ул. Тверская, д. 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Город *</FormLabel>
                      <FormControl>
                        <Input placeholder="Москва" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Регион</FormLabel>
                      <FormControl>
                        <Input placeholder="Московская область" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Индекс</FormLabel>
                      <FormControl>
                        <Input placeholder="123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Manager Contact */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-medium">
                <User className="h-4 w-4" />
                Контактное лицо
              </h4>

              <FormField
                control={form.control}
                name="manager_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ФИО менеджера</FormLabel>
                    <FormControl>
                      <Input placeholder="Иванов Иван Иванович" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="manager_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Mail className="mr-1 inline h-4 w-4" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="manager@store.ru" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="manager_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Phone className="mr-1 inline h-4 w-4" />
                        Телефон
                      </FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+7 (999) 123-45-67" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Terms */}
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              <p>
                Регистрируя магазин, вы соглашаетесь с{' '}
                <a href="/terms" className="text-primary underline">
                  условиями использования
                </a>{' '}
                платформы Честно и подтверждаете, что имеете право представлять данный магазин.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Отмена
                </Button>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Регистрация...
                  </>
                ) : (
                  'Зарегистрировать магазин'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default StoreRegistrationForm
