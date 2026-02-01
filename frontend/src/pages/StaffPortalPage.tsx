/**
 * StaffPortalPage
 *
 * Staff training portal page with training modules, certification,
 * and leaderboard for retail staff engagement.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  BookOpen,
  GraduationCap,
  Trophy,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StaffTrainingPortal } from '@/components/staff/StaffTrainingPortal'
import { CertificationBadge } from '@/components/staff/CertificationBadge'
import { StaffLeaderboard } from '@/components/staff/StaffLeaderboard'
import { getMyCertification } from '@/api/staffService'
import type { StaffCertification } from '@/types/retail'

export function StaffPortalPage() {
  const [activeTab, setActiveTab] = useState('training')
  const [certification, setCertification] = useState<StaffCertification | null>(null)
  const [loading, setLoading] = useState(true)

  // Load certification status
  useEffect(() => {
    const loadCertification = async () => {
      try {
        const data = await getMyCertification()
        setCertification(data)
      } catch (err) {
        console.error('Failed to load certification:', err)
        // Create mock certification for demo
        setCertification({
          staff_id: 'demo-staff',
          staff_name: 'Demo User',
          store_name: 'Demo Store',
          is_certified: false,
          modules_completed: 2,
          total_modules: 4,
        })
      } finally {
        setLoading(false)
      }
    }

    loadCertification()
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/retail">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к панели
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <GraduationCap className="h-7 w-7 text-primary" />
              Портал обучения
            </h1>
            <p className="mt-1 text-muted-foreground">
              Станьте сертифицированным Амбассадором Честно
            </p>
          </div>

          {certification?.is_certified && (
            <div className="flex items-center gap-2">
              <Award className="h-6 w-6 text-green-500" />
              <span className="font-medium text-green-700">Сертифицирован</span>
            </div>
          )}
        </div>
      </div>

      {/* Certification Badge (if certified) */}
      {!loading && certification?.is_certified && (
        <div className="mb-6">
          <CertificationBadge certification={certification} size="md" />
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="training">
            <BookOpen className="mr-2 h-4 w-4" />
            Обучение
          </TabsTrigger>
          <TabsTrigger value="certification">
            <Award className="mr-2 h-4 w-4" />
            Сертификат
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <Trophy className="mr-2 h-4 w-4" />
            Лидеры
          </TabsTrigger>
        </TabsList>

        {/* Training Tab */}
        <TabsContent value="training">
          <StaffTrainingPortal />
        </TabsContent>

        {/* Certification Tab */}
        <TabsContent value="certification">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Current certification */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ваш сертификат</CardTitle>
                  <CardDescription>
                    Текущий статус сертификации
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="animate-pulse space-y-4">
                      <div className="h-24 rounded bg-muted" />
                    </div>
                  ) : certification ? (
                    <CertificationBadge
                      certification={certification}
                      showActions={true}
                      size="lg"
                    />
                  ) : (
                    <p className="text-muted-foreground">
                      Данные о сертификации недоступны
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle>Преимущества сертификации</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {[
                      'Официальный статус Амбассадора Честно',
                      'Бонусные баллы за консультации покупателей',
                      'Доступ к расширенным материалам',
                      'Участие в конкурсах и акциях',
                      'Персональный бейдж для профиля',
                    ].map((benefit, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Certification requirements */}
            <Card>
              <CardHeader>
                <CardTitle>Как получить сертификат?</CardTitle>
                <CardDescription>
                  Шаги для получения статуса Амбассадора
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {[
                    {
                      step: 1,
                      title: 'Пройдите обучение',
                      description: 'Завершите все модули в разделе "Обучение"',
                      icon: BookOpen,
                      completed: certification ? certification.modules_completed >= 3 : false,
                    },
                    {
                      step: 2,
                      title: 'Сдайте тест',
                      description: 'Наберите не менее 80% на финальном тесте',
                      icon: GraduationCap,
                      completed: certification?.is_certified || false,
                    },
                    {
                      step: 3,
                      title: 'Получите сертификат',
                      description: 'Скачайте и поделитесь своим достижением',
                      icon: Award,
                      completed: certification?.is_certified || false,
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-4">
                      <div
                        className={`
                          flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full
                          ${item.completed ? 'bg-green-100' : 'bg-muted'}
                        `}
                      >
                        <item.icon
                          className={`h-5 w-5 ${item.completed ? 'text-green-600' : 'text-muted-foreground'}`}
                        />
                      </div>
                      <div>
                        <p className={`font-medium ${item.completed ? 'text-green-700' : ''}`}>
                          {item.step}. {item.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {!certification?.is_certified && (
                  <Button
                    className="mt-6 w-full"
                    onClick={() => setActiveTab('training')}
                  >
                    Начать обучение
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Store leaderboard */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <Users className="h-5 w-5" />
                Лидеры вашего магазина
              </h3>
              <StaffLeaderboard
                storeId="demo-store"
                limit={5}
                showPeriodSelector={false}
              />
            </div>

            {/* Global leaderboard */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <Trophy className="h-5 w-5" />
                Топ по всей сети
              </h3>
              <StaffLeaderboard
                limit={10}
                showPeriodSelector={true}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default StaffPortalPage
