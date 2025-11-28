import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { afterSignup, startYandexLogin } from '@/api/authService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useUserStore } from '@/store/userStore'

const baseFields = {
  contactName: z.string().min(2, 'Укажите контактное лицо'),
  email: z.string().email('Неверный email'),
  password: z
    .string()
    .min(8, 'Минимум 8 символов')
    .regex(/^(?=.*[A-Z])(?=.*\d).+$/, 'Пароль должен содержать букву верхнего регистра и цифру'),
  confirmPassword: z.string(),
  inviteCode: z.string().optional(),
  websiteUrl: z
    .string()
    .url('Некорректный URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z.string().optional(),
  agree: z.boolean().refine((value) => value, {
    message: 'Необходимо согласие с условиями',
  }),
}

const producerSchema = z
  .object({
    ...baseFields,
    accountType: z.literal('producer'),
    companyName: z.string().min(2, 'Укажите название компании'),
    country: z.string().min(2, 'Укажите страну'),
    city: z.string().min(2, 'Укажите город'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Пароли не совпадают',
  })

const userSchema = z
  .object({
    ...baseFields,
    accountType: z.literal('user'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Пароли не совпадают',
  })

const registerSchema = z.union([producerSchema, userSchema])

type RegisterFormValues = z.infer<typeof registerSchema>

const defaultValues: RegisterFormValues = {
  accountType: 'producer',
  contactName: '',
  email: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  country: '',
  city: '',
  websiteUrl: undefined,
  phone: '',
  inviteCode: '',
  agree: false,
}

export const RegisterPage = () => {
  const supabase = getSupabaseClient()
  const navigate = useNavigate()
  const setSessionData = useUserStore((state) => state.setSessionData)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues,
  })

  const accountType = form.watch('accountType')

  const handleGoogleSignup = async () => {
    const redirectTo = `${window.location.origin}/auth/callback?provider=google&redirect=/dashboard`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  const handleYandexSignup = async () => {
    const redirectTo = `${window.location.origin}/auth/callback?provider=yandex&redirect=/dashboard`
    const url = await startYandexLogin(redirectTo)
    window.location.href = url
  }

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null)
    setSuccessMessage(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.contactName },
        },
      })
      if (error) throw new Error(error.message)

      const authUserId = data.user?.id
      if (!authUserId) {
        throw new Error('Не удалось получить идентификатор пользователя.')
      }

      const session = await afterSignup({
        auth_user_id: authUserId,
        email: values.email,
        contact_name: values.contactName,
        account_type: values.accountType,
        company_name: values.accountType === 'producer' ? values.companyName : undefined,
        country: values.accountType === 'producer' ? values.country : undefined,
        city: values.accountType === 'producer' ? values.city : undefined,
        website_url: values.websiteUrl,
        phone: values.phone,
        invite_code: values.inviteCode || undefined,
      })

      setSessionData(session)

      setSuccessMessage('Успешно! Перенаправляем в кабинет.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error(err)
      setServerError(
        err instanceof Error ? err.message : 'Не удалось завершить регистрацию. Попробуйте позже.',
      )
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm uppercase text-muted-foreground">Платформа «Работаем Честно!»</p>
        <h1 className="mt-2 text-3xl font-semibold">Регистрация на платформе</h1>
        <p className="mt-2 text-muted-foreground">
          Зарегистрируйтесь как производитель или как пользователь, чтобы следить за честными брендами.
        </p>
      </div>
      {serverError && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert>
          <AlertTitle>Готово</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Данные аккаунта</CardTitle>
          <CardDescription>
            Выберите тип аккаунта. Для производителей нужны данные компании, пользователи могут присоединиться позже.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 md:grid-cols-2">
            <Button variant="outline" onClick={handleGoogleSignup}>
              Регистрация через Google
            </Button>
            <Button variant="outline" onClick={handleYandexSignup}>
              Регистрация через Яндекс
            </Button>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип аккаунта</FormLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={field.value === 'producer' ? 'default' : 'outline'}
                        onClick={() => field.onChange('producer')}
                      >
                        Производство
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === 'user' ? 'default' : 'outline'}
                        onClick={() => field.onChange('user')}
                      >
                        Пользователь
                      </Button>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Как к вам обращаться?</FormLabel>
                    <FormControl>
                      <Input placeholder="Иван Иванов" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@brand.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пароль</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Подтверждение пароля</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {accountType === 'producer' && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Компания / бренд</FormLabel>
                          <FormControl>
                            <Input placeholder="ООО «Честное производство»" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Страна</FormLabel>
                          <FormControl>
                            <Input placeholder="Россия" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Город</FormLabel>
                        <FormControl>
                          <Input placeholder="Москва" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {accountType === 'user' && (
                <FormField
                  control={form.control}
                  name="inviteCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код приглашения (если есть)</FormLabel>
                      <FormControl>
                        <Input placeholder="CHSTN-XXXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон (опционально)</FormLabel>
                      <FormControl>
                        <Input placeholder="+7 (999) 000-00-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="websiteUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Сайт (опционально)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://brand.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="agree"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3">
                        <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
                        <p className="text-sm text-muted-foreground">
                          Я подтверждаю честность данных и принимаю условия сервиса и политику конфиденциальности.
                        </p>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting || !form.getValues('agree')}
              >
                {form.formState.isSubmitting ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm text-muted-foreground">
          Уже зарегистрированы?{' '}
          <Button variant="link" asChild className="px-0">
            <Link to="/login">Войти</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

