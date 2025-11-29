import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { login, startYandexLogin } from '@/api/authService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useUserStore } from '@/store/userStore'

const loginSchema = z.object({
  email: z.string().email('Неверный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export const LoginPage = () => {
  const supabase = getSupabaseClient()
  const setSessionData = useUserStore((state) => state.setSessionData)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const [debugMessages, setDebugMessages] = useState<string[]>([])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const handleGoogleLogin = async () => {
    const redirectTo = `${window.location.origin}/auth/callback?provider=google`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  const handleYandexLogin = async () => {
    const redirectTo = `${window.location.origin}/auth/callback?provider=yandex`
    const url = await startYandexLogin(redirectTo)
    window.location.href = url
  }

  useEffect(() => {
    if (!retryAfter) return
    const timer = setInterval(() => {
      setRetryAfter((prev) => {
        if (!prev) return null
        return prev > 1 ? prev - 1 : null
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [retryAfter])

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMessage(null)
    setRetryAfter(null)
    setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Нажата кнопка входа`, ...prev])
    try {
      console.log('Attempting login for:', values.email)
      setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Attempting login for ${values.email}`, ...prev])
      const response = await login(values.email, values.password)
      console.log('Login response received:', { 
        hasAccessToken: !!response.access_token, 
        hasRefreshToken: !!response.refresh_token,
        platformRoles: response.platform_roles 
      })
      setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Login response received (tokens OK)`, ...prev])
      
      const { data: sessionData, error } = await supabase.auth.setSession({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      })
      
      if (error) {
        console.error('Supabase setSession error:', error)
        throw new Error(error.message)
      }
      
      console.log('Session set successfully:', { hasSession: !!sessionData.session })
      setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Session set in Supabase`, ...prev])
      setSessionData(response)
      const pendingInvite = localStorage.getItem('pendingInviteCode')
      if (pendingInvite) {
        setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Redirect to invite/${pendingInvite}`, ...prev])
        window.location.href = `/invite/${pendingInvite}`
      } else {
        setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Redirect to /dashboard`, ...prev])
        // Полная перезагрузка страницы, чтобы гарантированно подтянуть сессию и роли
        window.location.href = '/dashboard'
      }
    } catch (err) {
      console.error('Login error:', err)
      setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Login error: ${String(err)}`, ...prev])
      if (axios.isAxiosError(err)) {
        console.error('Axios error details:', {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        })
        setDebugMessages((prev) => [
          `[${new Date().toLocaleTimeString()}] Axios error: status=${err.response?.status} url=${err.config?.url}`,
          ...prev,
        ])
        const detail = err.response?.data?.detail
        const message =
          typeof detail === 'string' ? detail : detail?.message ?? 'Не удалось выполнить вход. Проверьте данные.'
        setErrorMessage(message)
        if (detail?.retry_after_seconds) {
          setRetryAfter(detail?.retry_after_seconds)
        }
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Не удалось войти')
      }
    }
  }

  return (
    <div className="flex w-full justify-center px-4 py-6 sm:py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Вход</CardTitle>
          <CardDescription>Используйте email и пароль Supabase Auth.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-2">
            <Button variant="outline" className="w-full min-h-[44px]" onClick={handleGoogleLogin}>
              Войти через Google
            </Button>
            <Button variant="outline" className="w-full min-h-[44px]" onClick={handleYandexLogin}>
              Войти через Яндекс
            </Button>
          </div>
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <Button
                type="submit"
                className="w-full min-h-[44px]"
                disabled={form.formState.isSubmitting || Boolean(retryAfter)}
              >
                {form.formState.isSubmitting
                  ? 'Входим...'
                  : retryAfter
                    ? `Подождите ${retryAfter} c`
                    : 'Войти'}
              </Button>
            </form>
          </Form>

          {debugMessages.length > 0 && (
            <div className="mt-4 rounded-md border border-dashed border-amber-500 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="mb-1 font-semibold">Отладочная информация (видна только вам):</div>
              <ul className="space-y-0.5 max-h-40 overflow-auto">
                {debugMessages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
          <Button variant="link" className="mt-4 px-0 text-sm" asChild>
            <a href="#" aria-disabled>
              Забыли пароль? (скоро)
            </a>
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
          Нет аккаунта?{' '}
          <Button variant="link" asChild className="px-0">
            <Link to="/register">Зарегистрироваться</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

