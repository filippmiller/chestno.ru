/**
 * RetailDashboardPage
 *
 * Main retail partner dashboard providing access to store management,
 * analytics, kiosk configuration, and marketing materials.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  MapPin,
  Package,
  Plus,
  Printer,
  QrCode,
  Settings,
  Store,
  Tablet,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RetailStoreMap } from '@/components/retail/RetailStoreMap'
import { StoreAnalyticsDashboard } from '@/components/retail/StoreAnalyticsDashboard'
import { StoreRegistrationForm } from '@/components/retail/StoreRegistrationForm'
import { ShelfTalkerGenerator } from '@/components/marketing/ShelfTalkerGenerator'
import type { RetailStore } from '@/types/retail'

export function RetailDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [showRegistrationForm, setShowRegistrationForm] = useState(false)

  // Handle store selection from map
  const handleStoreSelect = (storeId: string) => {
    setSelectedStoreId(storeId)
    setActiveTab('analytics')
  }

  // Handle successful store registration
  const handleStoreRegistered = (store: RetailStore) => {
    setShowRegistrationForm(false)
    setSelectedStoreId(store.id)
    setActiveTab('analytics')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Store className="h-7 w-7 text-primary" />
            Розничная панель
          </h1>
          <p className="mt-1 text-muted-foreground">
            Управляйте магазинами, отслеживайте аналитику и создавайте маркетинговые материалы
          </p>
        </div>

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/retail/staff">
              <Users className="mr-2 h-4 w-4" />
              Обучение
            </Link>
          </Button>
          <Button onClick={() => setShowRegistrationForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить магазин
          </Button>
        </div>
      </div>

      {/* Registration Form Modal/Section */}
      {showRegistrationForm && (
        <div className="mb-6">
          <StoreRegistrationForm
            onSuccess={handleStoreRegistered}
            onCancel={() => setShowRegistrationForm(false)}
          />
        </div>
      )}

      {/* Quick Stats */}
      {!showRegistrationForm && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Магазинов
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">12</p>
              <p className="text-xs text-muted-foreground">3 новых за месяц</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <QrCode className="h-4 w-4" />
                Сканирований
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">4,521</p>
              <p className="text-xs text-green-600">+23% к прошлому месяцу</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Tablet className="h-4 w-4" />
                Активных киосков
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">8</p>
              <p className="text-xs text-muted-foreground">Все онлайн</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                Обученных сотрудников
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">45</p>
              <p className="text-xs text-muted-foreground">28 сертифицировано</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      {!showRegistrationForm && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">
              <MapPin className="mr-2 h-4 w-4" />
              Обзор
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Аналитика
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="mr-2 h-4 w-4" />
              Товары
            </TabsTrigger>
            <TabsTrigger value="marketing">
              <Printer className="mr-2 h-4 w-4" />
              Маркетинг
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Настройки
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Store Map */}
          <TabsContent value="overview">
            <RetailStoreMap
              onStoreSelect={handleStoreSelect}
              selectedStoreId={selectedStoreId || undefined}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            {selectedStoreId ? (
              <StoreAnalyticsDashboard storeId={selectedStoreId} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-lg font-medium">Выберите магазин</p>
                  <p className="text-muted-foreground">
                    Выберите магазин на карте или из списка для просмотра аналитики
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setActiveTab('overview')}
                  >
                    Перейти к карте
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Товары в магазинах</CardTitle>
                <CardDescription>
                  Управляйте ассортиментом верифицированных товаров в ваших магазинах
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4">
                    Выберите магазин для управления товарами
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Marketing Tab */}
          <TabsContent value="marketing">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Создание маркетинговых материалов</CardTitle>
                  <CardDescription>
                    Генерируйте ценники, постеры и цифровые вывески с QR-кодами
                  </CardDescription>
                </CardHeader>
              </Card>

              <ShelfTalkerGenerator />
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Настройки киосков</CardTitle>
                  <CardDescription>
                    Управляйте киосками в ваших магазинах
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/retail/kiosk/manage">
                      <Tablet className="mr-2 h-4 w-4" />
                      Управление киосками
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Обучение персонала</CardTitle>
                  <CardDescription>
                    Управляйте программой обучения сотрудников
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/retail/staff">
                      <Users className="mr-2 h-4 w-4" />
                      Портал обучения
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Интеграции</CardTitle>
                  <CardDescription>
                    Настройте интеграцию с POS-системами
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" disabled>
                    <Settings className="mr-2 h-4 w-4" />
                    Настроить POS (скоро)
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>API доступ</CardTitle>
                  <CardDescription>
                    Получите ключи API для интеграции
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" disabled>
                    <Settings className="mr-2 h-4 w-4" />
                    Получить API ключ (скоро)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export default RetailDashboardPage
