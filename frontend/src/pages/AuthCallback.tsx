import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { fetchSession } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useUserStore } from '@/store/userStore'

const parseHashParams = () => {
  if (!window.location.hash) return null
  const hash = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(hash)
  if (params.has('access_token') && params.has('refresh_token')) {
    return {
      access_token: params.get('access_token')!,
      refresh_token: params.get('refresh_token')!,
      expires_in: Number(params.get('expires_in') ?? '3600'),
    }
  }
  return null
}

export const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams()
  const supabase = getSupabaseClient()
  const navigate = useNavigate()
  const setSessionData = useUserStore((state) => state.setSessionData)
  const redirect = searchParams.get('redirect') || '/dashboard'

  useEffect(() => {
    const handleCallback = async () => {
      const queryToken = searchParams.get('access_token')
      const refreshToken = searchParams.get('refresh_token')
      let tokens = null
      if (queryToken && refreshToken) {
        tokens = {
          access_token: queryToken,
          refresh_token: refreshToken,
          expires_in: Number(searchParams.get('expires_in') ?? '3600'),
        }
      } else {
        tokens = parseHashParams()
      }
      if (tokens) {
        await supabase.auth.setSession(tokens)
        window.location.hash = ''
      }
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        return
      }
      const sessionPayload = await fetchSession()
      setSessionData(sessionPayload)
      navigate(redirect, { replace: true })
    }
    void handleCallback()
  }, [navigate, redirect, searchParams, setSessionData, supabase])

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Alert>
        <AlertTitle>Завершаем вход…</AlertTitle>
        <AlertDescription>Подтверждаем сессию и перенаправляем.</AlertDescription>
      </Alert>
    </div>
  )
}

