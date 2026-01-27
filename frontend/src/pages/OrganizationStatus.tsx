import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpCircle, Award, TrendingUp } from 'lucide-react'

import { getOrganizationStatus, getOrganizationStatusHistory, requestStatusUpgrade } from '@/api/authService'
import { StatusCard } from '@/components/status/StatusCard'
import { LevelCProgress } from '@/components/status/LevelCProgress'
import { StatusHistory } from '@/components/status/StatusHistory'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserStore } from '@/store/userStore'
import type { OrganizationStatusResponse, StatusHistoryResponse } from '@/types/auth'

const LEVEL_CONFIG = {
  A: {
    label: 'Уровень A',
    description: 'Базовый статус',
    color: 'bg-gray-500',
  },
  B: {
    label: 'Уровень B',
    description: 'Повышенный статус',
    color: 'bg-blue-500',
  },
  C: {
    label: 'Уровень C',
    description: 'Премиум статус',
    color: 'bg-green-500',
  },
} as const

const HISTORY_PAGE_SIZE = 20

export const OrganizationStatusPage = () => {
  const navigate = useNavigate()
  const { organizations, selectedOrganizationId } = useUserStore()
  const [status, setStatus] = useState<OrganizationStatusResponse | null>(null)
  const [history, setHistory] = useState<StatusHistoryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )

  useEffect(() => {
    const loadStatus = async () => {
      if (!currentOrganization) return
      setLoading(true)
      setError(null)
      try {
        const data = await getOrganizationStatus(currentOrganization.id)
        setStatus(data)
      } catch (err) {
        console.error(err)
        setError('Не удалось загрузить данные о статусе организации')
      } finally {
        setLoading(false)
      }
    }
    void loadStatus()
  }, [currentOrganization])

  useEffect(() => {
    const loadHistory = async () => {
      if (!currentOrganization) return
      setHistoryLoading(true)
      try {
        const data = await getOrganizationStatusHistory(currentOrganization.id, {
          limit: HISTORY_PAGE_SIZE,
          offset: historyOffset,
        })
        setHistory(data)
      } catch (err) {
        console.error(err)
      } finally {
        setHistoryLoading(false)
      }
    }
    void loadHistory()
  }, [currentOrganization, historyOffset])

  const handleRequestUpgrade = async () => {
    if (!currentOrganization || !status?.next_level_progress?.next_level) return

    setUpgradeLoading(true)
    setError(null)
    setUpgradeSuccess(false)

    try {
      await requestStatusUpgrade(currentOrganization.id, status.next_level_progress.next_level)
      setUpgradeSuccess(true)
      // Reload status
      const data = await getOrganizationStatus(currentOrganization.id)
      setStatus(data)
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail || 'Не удалось отправить заявку на повышение статуса')
    } finally {
      setUpgradeLoading(false)
    }
  }

  if (!currentOrganization) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Нет организации</AlertTitle>
          <AlertDescription>Сначала создайте организацию или примите приглашение.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const currentLevelDetails = status?.active_levels.find((level) => level.level === status.current_level)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <button onClick={() => navigate('/dashboard')} className="hover:underline">
            Главная
          </button>
          <span>/</span>
          <span>Статус организации</span>
        </div>
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Award className="h-8 w-8" />
          {currentOrganization.name}
        </h1>
        <p className="text-muted-foreground mt-2">
          Управляйте статусом вашей организации и отслеживайте прогресс к более высоким уровням.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {upgradeSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <AlertTitle className="text-green-900">Заявка отправлена</AlertTitle>
          <AlertDescription className="text-green-800">
            Ваша заявка на повышение статуса успешно отправлена. Мы рассмотрим её в ближайшее время.
          </AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Загружаем...</p>}

      {status && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Current Status Card */}
          <StatusCard level={status.current_level} details={currentLevelDetails} />

          {/* Active Levels Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Активные уровни
              </CardTitle>
              <CardDescription>Все ваши текущие статусы</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {status.active_levels.length === 0 ? (
                <p className="text-muted-foreground text-sm">Нет активных уровней</p>
              ) : (
                status.active_levels.map((level) => {
                  const config = LEVEL_CONFIG[level.level]
                  return (
                    <div key={level.level} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Badge className={`${config.color} text-white mb-1`}>{config.label}</Badge>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                      </div>
                      {level.is_active && <Badge variant="outline">Активен</Badge>}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Level C Progress */}
      {status?.next_level_progress && (
        <div className="space-y-4">
          <LevelCProgress progress={status.next_level_progress} />

          {/* Upgrade Button */}
          {status.can_request_upgrade && status.next_level_progress.is_eligible && (
            <div className="flex justify-center">
              <Button size="lg" onClick={handleRequestUpgrade} disabled={upgradeLoading} className="gap-2">
                <ArrowUpCircle className="h-5 w-5" />
                {upgradeLoading ? 'Отправка...' : `Запросить уровень ${status.next_level_progress.next_level}`}
              </Button>
            </div>
          )}

          {!status.can_request_upgrade && status.upgrade_blocked_reason && (
            <Alert>
              <AlertTitle>Запрос временно недоступен</AlertTitle>
              <AlertDescription>{status.upgrade_blocked_reason}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Status History */}
      {history && (
        <StatusHistory
          entries={history.items}
          total={history.total}
          limit={history.limit}
          offset={history.offset}
          onPageChange={setHistoryOffset}
          loading={historyLoading}
        />
      )}
    </div>
  )
}
