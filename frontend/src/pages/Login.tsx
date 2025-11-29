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
    console.log('[Login.onSubmit] ===== FORM SUBMISSION STARTED =====')
    console.log('[Login.onSubmit] Form values:', { email: values.email, passwordLength: values.password.length })
    console.log('[Login.onSubmit] Form state:', { isSubmitting: form.formState.isSubmitting, isValid: form.formState.isValid })

    setErrorMessage(null)
    setRetryAfter(null)
    setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Нажата кнопка входа`, ...prev])

    try {
      console.log('[Login.onSubmit] Calling login function...')
      console.log('[Login.onSubmit] Attempting login for:', values.email)
      setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Attempting login for ${values.email}`, ...prev])

      const loginPromise = login(values.email, values.password)
      console.log('[Login.onSubmit] Login promise created, awaiting...')

      const response = await loginPromise
      console.log('[Login.onSubmit] Login promise resolved, got response')
      console.log('Login response received:', {
        hasAccessToken: !!response.access_token,
        hasRefreshToken: !!response.refresh_token,
        platformRoles: response.platform_roles
      })
      setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Login response received (tokens OK)`, ...prev])

      // Set session with timeout to prevent hanging
      setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Setting Supabase session...`, ...prev])

      // Log token details for debugging
      console.log('[Login] Token details:', {
        hasAccessToken: !!response.access_token,
        accessTokenLength: response.access_token?.length || 0,
        hasRefreshToken: !!response.refresh_token,
        refreshTokenLength: response.refresh_token?.length || 0,
        refreshTokenPreview: response.refresh_token ? `${response.refresh_token.substring(0, 20)}...` : 'none',
        expiresIn: response.expires_in,
      })

      if (!response.refresh_token) {
        console.error('[Login] CRITICAL: No refresh_token in response!')
        throw new Error('No refresh_token received from server')
      }

      let sessionSetSuccessfully = false

      // Try setSession with shorter timeout (3 seconds) - if it hangs, use direct storage
      try {
        console.log('[Login] Attempting supabase.auth.setSession (3s timeout)...')
        const sessionData = {
          access_token: response.access_token,
          refresh_token: response.refresh_token,
        }

        const setSessionPromise = supabase.auth.setSession(sessionData)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('setSession timeout after 10 seconds')), 10000)
        })

        const result = await Promise.race([setSessionPromise, timeoutPromise])

        if (result.error) {
          console.warn('[Login] setSession returned error:', result.error.message)
        } else if (result.data?.session) {
          console.log('[Login] setSession succeeded via API')
          sessionSetSuccessfully = true
        }
      } catch (sessionError) {
        console.warn('[Login] setSession timed out or failed, using direct storage method:', sessionError)
      }

      // If setSession failed or timed out, save tokens directly to localStorage
      // Supabase stores session in localStorage with key: `sb-${projectRef}-auth-token`
      if (!sessionSetSuccessfully) {
        try {
          console.log('[Login] Saving tokens directly to localStorage (fallback method)...')
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
          const projectRef = supabaseUrl?.split('//')[1]?.split('.')[0] || 'unknown'
          const storageKey = `sb-${projectRef}-auth-token`

          // Calculate expires_at (current time + expires_in seconds)
          const expiresAt = Math.floor(Date.now() / 1000) + (response.expires_in || 3600)

          // Create session object in Supabase format
          const sessionObject = {
            access_token: response.access_token,
            refresh_token: response.refresh_token,
            expires_at: expiresAt,
            expires_in: response.expires_in || 3600,
            token_type: response.token_type || 'bearer',
            user: response.supabase_user || response.user,
          }

          // Save to localStorage
          localStorage.setItem(storageKey, JSON.stringify(sessionObject))
          console.log('[Login] Tokens saved to localStorage with key:', storageKey)
          console.log('[Login] Session object saved:', {
            hasAccessToken: !!sessionObject.access_token,
            hasRefreshToken: !!sessionObject.refresh_token,
            expiresAt: sessionObject.expires_at,
            userId: sessionObject.user?.id,
          })

          // Small delay to let Supabase SDK pick up the change
          await new Promise(resolve => setTimeout(resolve, 100))

          // Verify by getting session
          const { data: verifyData, error: verifyError } = await supabase.auth.getSession()
          if (verifyError) {
            console.error('[Login] Error verifying session after direct save:', verifyError)
          } else if (verifyData.session) {
            console.log('[Login] Session verified after direct save:', {
              userId: verifyData.session.user.id,
              hasRefreshToken: !!verifyData.session.refresh_token,
            })
            sessionSetSuccessfully = true
            setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Session saved via direct storage`, ...prev])
          } else {
            console.warn('[Login] Direct save completed but session not found in getSession')
          }
        } catch (directSaveError) {
          console.error('[Login] Direct save failed:', directSaveError)
          setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Direct save error: ${String(directSaveError)}`, ...prev])
        }
      } else {
        // Verify session if setSession succeeded
        const { data: verifyData, error: verifyError } = await supabase.auth.getSession()
        if (verifyError) {
          console.error('[Login] Error verifying session:', verifyError)
          sessionSetSuccessfully = false
        } else if (verifyData.session) {
          console.log('[Login] Session verified:', {
            userId: verifyData.session.user.id,
            hasRefreshToken: !!verifyData.session.refresh_token,
          })
          sessionSetSuccessfully = true
          setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Session set via setSession API`, ...prev])
        }
      }

      if (!sessionSetSuccessfully) {
        console.warn('[Login] WARNING: Session setup may be incomplete, but continuing with redirect')
        setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] WARNING: Session setup incomplete`, ...prev])
      }

      // Store session data and redirect
      setSessionData(response)
      setDebugMessages((prev) => [`[${new Date().toLocaleTimeString()}] Session data stored, redirecting...`, ...prev])

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
            <form
              onSubmit={(e) => {
                console.log('[Login] Form onSubmit event fired')
                console.log('[Login] Event:', e)
                console.log('[Login] Form validity before handleSubmit:', form.formState.isValid)
                console.log('[Login] Form errors:', form.formState.errors)

                // Call react-hook-form's handleSubmit
                form.handleSubmit(onSubmit)(e)
              }}
              className="space-y-4"
            >
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
                onClick={() => {
                  console.log('[Login] Submit button clicked')
                  console.log('[Login] Form state:', {
                    isSubmitting: form.formState.isSubmitting,
                    isValid: form.formState.isValid,
                    errors: form.formState.errors,
                  })
                  console.log('[Login] Form values:', form.getValues())
                }}
              >
                {form.formState.isSubmitting
                  ? 'Входим...'
                  : retryAfter
                    ? `Подождите ${retryAfter} c`
                    : 'Войти'}
              </Button>
            </form>
          </Form>

          {/* Debug messages disabled */}
          {false && debugMessages.length > 0 && (
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

