import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { acceptInvite, previewInvite } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserStore } from '@/store/userStore'
import type { OrganizationInvitePreview, SessionPayload } from '@/types/auth'

const isSessionPayload = (payload: unknown): payload is SessionPayload => {
  if (!payload || typeof payload !== 'object') return false
  return 'user' in payload && 'memberships' in payload && 'organizations' in payload
}

export const InviteLandingPage = () => {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, setSessionData } = useUserStore()
  const [preview, setPreview] = useState<OrganizationInvitePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    setLoading(true)
    setError(null)
    previewInvite(code)
      .then((data) => {
        setPreview(data)
        localStorage.setItem('pendingInviteCode', code)
      })
      .catch(() => setError('Приглашение не найдено или уже недействительно'))
      .finally(() => setLoading(false))
  }, [code])

  const handleAccept = async () => {
    if (!code) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await acceptInvite(code)
      if (isSessionPayload(response)) {
        setSessionData(response)
        localStorage.removeItem('pendingInviteCode')
        setSuccess('Вы присоединились к организации')
        navigate('/dashboard', { replace: true })
      } else {
        setPreview(response)
        setError('Нужна авторизация, чтобы принять приглашение')
      }
    } catch (err) {
      console.error(err)
      setError('Не удалось принять приглашение. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  if (!code) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Некорректная ссылка</AlertTitle>
          <AlertDescription>Проверьте URL приглашения.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Приглашение в организацию</CardTitle>
          <CardDescription>Код: {code}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Загружаем данные приглашения…</p>}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertTitle>Готово</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          {preview && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Организация</p>
              <h2 className="text-2xl font-semibold">{preview.organization_name}</h2>
              <p className="text-sm text-muted-foreground">Роль: {preview.role}</p>
            </div>
          )}
          {!user ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
              <p className="text-sm text-muted-foreground">
                Войдите или зарегистрируйтесь, чтобы присоединиться к организации. Код сохранён и будет доступен после
                входа.
              </p>
              <div className="flex gap-3">
                <Button asChild>
                  <Link to="/login">Войти</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/register">Регистрация</Link>
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleAccept} disabled={loading}>
              {loading ? 'Присоединяем…' : 'Присоединиться'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

