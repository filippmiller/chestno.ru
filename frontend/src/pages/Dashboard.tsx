import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ShieldCheck, FileText, Users, QrCode, CheckCircle, Package, CreditCard, ClipboardList, BarChart2, LayoutDashboard, Link2, Newspaper, MessageSquare, TrendingUp } from 'lucide-react'

import { fetchSession } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useUserStore } from '@/store/userStore'

const roleLabels: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  manager: 'Менеджер',
  editor: 'Редактор',
  analyst: 'Аналитик',
  viewer: 'Наблюдатель',
}

const PROFILE_EDIT_ROLES = new Set(['owner', 'admin', 'manager', 'editor'])
const INVITE_ROLES = new Set(['owner', 'admin', 'manager'])
const MODERATOR_ROLES = new Set(['platform_admin', 'moderator'])

export const DashboardPage = () => {
  const {
    user,
    memberships,
    organizations,
    selectedOrganizationId,
    setSessionData,
    loading,
    setLoading,
    setSelectedOrganization,
    platformRoles,
  } = useUserStore()

  useEffect(() => {
    if (!user) {
      setLoading(true)
      // First check if we have a Supabase session
      const supabase = getSupabaseClient()
      supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
        if (sessionError) {
          console.error('Error getting Supabase session:', sessionError)
          setLoading(false)
          return
        }
        if (!session) {
          console.warn('No Supabase session found. User may need to log in again.')
          setLoading(false)
          return
        }
        // We have a session, now fetch full session data from backend
        fetchSession()
          .then((sessionData) => {
            console.log('Session data loaded:', sessionData)
            console.log('Platform roles:', sessionData.platform_roles)
            setSessionData(sessionData)
          })
          .catch((error) => {
            console.error('Error fetching session from backend:', error)
            // If fetchSession fails, try to get basic info from Supabase session
            if (session.user && session.user.email) {
              console.warn('Using Supabase session data as fallback')
              setSessionData({
                user: {
                  id: session.user.id,
                  email: session.user.email,
                  full_name: session.user.user_metadata?.full_name || null,
                  locale: session.user.user_metadata?.locale || null,
                },
                organizations: [],
                memberships: [],
                platform_roles: [],
              })
            }
          })
          .finally(() => setLoading(false))
      })
    }
  }, [user, setLoading, setSessionData])

  useEffect(() => {
    if (!selectedOrganizationId && memberships[0]) {
      setSelectedOrganization(memberships[0].organization_id)
    }
  }, [selectedOrganizationId, memberships, setSelectedOrganization])

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )
  const selectedMembership = memberships.find((m) => m.organization_id === selectedOrganization?.id)
  const canEditProfile = selectedMembership ? PROFILE_EDIT_ROLES.has(selectedMembership.role) : false
  const canManageInvites = selectedMembership ? INVITE_ROLES.has(selectedMembership.role) : false
  const showModerationLink = platformRoles.some((role) => MODERATOR_ROLES.has(role))
  const isPlatformAdmin = platformRoles.includes('platform_admin')
  
  // Debug logging
  useEffect(() => {
    console.log('Dashboard - platformRoles:', platformRoles)
    console.log('Dashboard - isPlatformAdmin:', isPlatformAdmin)
    console.log('Dashboard - showModerationLink:', showModerationLink)
  }, [platformRoles, isPlatformAdmin, showModerationLink])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-6 px-4 py-6 sm:py-10">
      <div>
        <p className="text-xs text-muted-foreground sm:text-sm">Кабинет участника платформы</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Здравствуйте{user?.full_name ? `, ${user.full_name}` : ''}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Управляйте организациями, контентом и профилем производства. Следите за статусом проверок и приглашайте коллег.
        </p>
      </div>
      {!loading && organizations.length === 0 && (
        <Alert>
          <AlertTitle>Пока нет организаций</AlertTitle>
          <AlertDescription>
            Вы можете зарегистрироваться как производитель, чтобы создать организацию, или дождаться приглашения.
          </AlertDescription>
        </Alert>
      )}
      {loading && (
        <Alert>
          <AlertTitle>Загружаем данные профиля…</AlertTitle>
          <AlertDescription>Пожалуйста, подождите пару секунд.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Профиль</CardTitle>
            <CardDescription>Данные синхронизируются с Supabase Auth</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Имя</p>
              <p className="font-medium">{user?.full_name ?? '—'}</p>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span>Права доступа определяются ролями в организациях.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Организации</CardTitle>
            <CardDescription>Вы участник {memberships.length} организации(-й)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {organizations.length > 1 && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Текущая организация</p>
                <select
                  value={selectedOrganization?.id ?? ''}
                  onChange={(event) => setSelectedOrganization(event.target.value || null)}
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
            {memberships.map((membership) => {
              const organization = organizations.find((org) => org.id === membership.organization_id)
              return (
                <div
                  key={membership.id}
                  className={`rounded-lg border p-3 ${membership.organization_id === selectedOrganization?.id ? 'border-primary' : 'border-border'}`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Building2 className="h-4 w-4 text-primary" />
                    {organization?.name ?? 'Организация'}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Роль: {roleLabels[membership.role] ?? membership.role}
                    {organization?.city ? ` • ${organization.city}` : ''}
                  </p>
                  {organization?.verification_status && (
                    <p className="text-xs uppercase text-muted-foreground">
                      Статус верификации: {organization.verification_status}
                    </p>
                  )}
                </div>
              )
            })}
            {memberships.length === 0 && <p className="text-sm text-muted-foreground">Нет членств</p>}
          </CardContent>
        </Card>
      </div>

      {selectedOrganization && (
        <Card>
          <CardHeader>
            <CardTitle>Профиль организации</CardTitle>
            <CardDescription>
              Обновляйте описание, материалы и теги, чтобы посетители видели честную историю вашего производства.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">{selectedOrganization.name}</p>
              <p>
                {selectedOrganization.city && `${selectedOrganization.city}, `}
                {selectedOrganization.country}
              </p>
              {selectedOrganization.website_url && (
                <a href={selectedOrganization.website_url} target="_blank" rel="noreferrer" className="text-primary underline">
                  {selectedOrganization.website_url}
                </a>
              )}
            </div>
            {selectedMembership && (
              <p>
                Ваша роль: <span className="font-medium">{roleLabels[selectedMembership.role] ?? selectedMembership.role}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button asChild variant={canEditProfile ? 'default' : 'outline'} className="min-h-[44px] text-xs sm:text-sm">
                <Link to="/dashboard/organization/profile">
                  <FileText className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{canEditProfile ? 'Редактировать профиль' : 'Открыть профиль'}</span>
                  <span className="sm:hidden">Профиль</span>
                </Link>
              </Button>
              <Button asChild variant={canManageInvites ? 'default' : 'outline'} className="min-h-[44px] text-xs sm:text-sm">
                <Link to="/dashboard/organization/invites">
                  <Users className="mr-1 h-4 w-4 sm:mr-2" />
                  Инвайты
                </Link>
              </Button>
              <Button asChild variant={canEditProfile ? 'default' : 'outline'} className="min-h-[44px] text-xs sm:text-sm">
                <Link to="/dashboard/organization/qr">
                  <QrCode className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">QR-коды</span>
                  <span className="sm:hidden">QR</span>
                </Link>
              </Button>
              <Button asChild variant={canEditProfile ? 'default' : 'outline'} className="min-h-[44px] text-xs sm:text-sm">
                <Link to="/dashboard/organization/marketing/qr-poster">
                  <QrCode className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">QR Poster</span>
                  <span className="sm:hidden">Poster</span>
                </Link>
              </Button>
              {canEditProfile && (
                <Button asChild className="min-h-[44px] text-xs sm:text-sm">
                  <Link to="/dashboard/organization/products">
                    <Package className="mr-1 h-4 w-4 sm:mr-2" />
                    Товары
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="min-h-[44px] text-xs sm:text-sm">
                <Link to="/dashboard/organization/plan">
                  <CreditCard className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Тариф и лимиты</span>
                  <span className="sm:hidden">Тариф</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-[44px] text-xs sm:text-sm">
                <Link to="/dashboard/organization/onboarding">
                  <ClipboardList className="mr-1 h-4 w-4 sm:mr-2" />
                  Онбординг
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard/organization/analytics">
                  <BarChart2 className="mr-2 h-4 w-4" />
                  Аналитика
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard/organization/benchmarks">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Конкуренты
                </Link>
              </Button>
              {canEditProfile && (
                <Button asChild variant="outline">
                  <Link to="/dashboard/organization/posts">
                    <Newspaper className="mr-2 h-4 w-4" />
                    Новости
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/dashboard/organization/reviews">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Отзывы
                </Link>
              </Button>
            </div>
            {!canEditProfile && (
              <p className="text-xs text-muted-foreground">
                Для редактирования профиля обратитесь к владельцу или администратору.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Настройки аккаунта</CardTitle>
          <CardDescription>Управляйте настройками вашего аккаунта и способами входа.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/settings/linked-accounts">
                <Link2 className="mr-2 h-4 w-4" />
                Связанные аккаунты
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/settings/notifications">
                <FileText className="mr-2 h-4 w-4" />
                Уведомления
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {showModerationLink && (
        <Card>
          <CardHeader>
            <CardTitle>Модерация платформы</CardTitle>
            <CardDescription>Проверяйте новых производителей и обновляйте статусы.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/dashboard/moderation/organizations">
                <CheckCircle className="mr-2 h-4 w-4" />
                Перейти к модерации
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isPlatformAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Админ-дашборд</CardTitle>
              <CardDescription>Ключевые метрики по организациям и активности.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/dashboard/admin">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Перейти к метрикам
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Админ-панель</CardTitle>
              <CardDescription>Управление платформой, модерация регистраций и настройки.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/admin">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Админ-панель
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard/moderation/organizations">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Модерация регистраций
                </Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

