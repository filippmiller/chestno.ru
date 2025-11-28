import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'

import { getLinkedAccounts } from '@/api/authService'
import type { LinkedAccount } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google',
  yandex: 'Yandex',
  email: 'Email/Password',
} as const

export const LinkedAccountsPage = () => {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getLinkedAccounts()
        setAccounts(data)
      } catch (err) {
        console.error(err)
        setError('Не удалось загрузить связанные аккаунты')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Связанные аккаунты</h1>
        <p className="text-muted-foreground">
          Управляйте способами входа в ваш аккаунт. Вы можете использовать несколько методов для входа.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Способы входа</CardTitle>
          <CardDescription>
            Список всех способов, которые вы можете использовать для входа в аккаунт.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
          {!loading && accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">Нет связанных аккаунтов</p>
          )}
          {!loading && accounts.length > 0 && (
            <div className="space-y-3">
              {accounts.map((account, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{PROVIDER_NAMES[account.provider] || account.provider}</span>
                        <Badge variant="secondary" className="text-xs">
                          {account.provider}
                        </Badge>
                      </div>
                      {account.email && (
                        <p className="text-sm text-muted-foreground">{account.email}</p>
                      )}
                      {account.created_at && (
                        <p className="text-xs text-muted-foreground">
                          Связан {new Date(account.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.provider === 'google' && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href="https://myaccount.google.com/security"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Управление
                        </a>
                      </Button>
                    )}
                    {account.provider === 'yandex' && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href="https://passport.yandex.ru/profile"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Управление
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>Как добавить новый способ входа?</AlertTitle>
        <AlertDescription>
          При следующем входе через социальную сеть (Google или Yandex) с тем же email, что и у вашего аккаунта,
          аккаунты автоматически свяжутся. Вы сможете использовать любой из связанных способов для входа.
        </AlertDescription>
      </Alert>
    </div>
  )
}

