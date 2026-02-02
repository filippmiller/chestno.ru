import { useEffect, useState, useCallback } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Package, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SupplyChainEditor, SupplyChainMap, SupplyChainTimeline } from '@/components/supply-chain'
import { useAuthV2 } from '@/auth/AuthProviderV2'
import * as supplyChainService from '@/api/supplyChainService'
import { httpClient } from '@/api/httpClient'
import type { SupplyChainJourney } from '@/types/supply-chain'

interface Product {
  id: string
  name: string
  slug: string
}

/**
 * Organization Supply Chain Management Page
 * Allows organization admins to view and edit supply chains for their products.
 */
export function OrganizationSupplyChainPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedProductId = searchParams.get('product')

  const { user, organizationId: userOrgId } = useAuthV2()

  const [products, setProducts] = useState<Product[]>([])
  const [journey, setJourney] = useState<SupplyChainJourney | null>(null)
  const [loading, setLoading] = useState(true)
  const [journeyLoading, setJourneyLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use org ID from URL or from auth context
  const organizationId = orgId || userOrgId

  // Load products for the organization
  useEffect(() => {
    const loadProducts = async () => {
      if (!organizationId) return

      setLoading(true)
      setError(null)

      try {
        const response = await httpClient.get<{ products: Product[] }>(
          `/api/organizations/${organizationId}/products`
        )
        setProducts(response.data.products || [])

        // Auto-select first product if none selected
        if (!selectedProductId && response.data.products?.length > 0) {
          setSearchParams({ product: response.data.products[0].id })
        }
      } catch (err) {
        console.error('Failed to load products:', err)
        setError('Не удалось загрузить список товаров')
      } finally {
        setLoading(false)
      }
    }

    void loadProducts()
  }, [organizationId, selectedProductId, setSearchParams])

  // Load journey for selected product
  const loadJourney = useCallback(async () => {
    if (!selectedProductId) {
      setJourney(null)
      return
    }

    setJourneyLoading(true)

    try {
      const data = await supplyChainService.getProductSupplyChain(selectedProductId)
      setJourney(data)
    } catch (err) {
      console.error('Failed to load supply chain:', err)
      // Don't show error for empty journey
      setJourney({
        product_id: selectedProductId,
        product_name: products.find((p) => p.id === selectedProductId)?.name || '',
        product_slug: products.find((p) => p.id === selectedProductId)?.slug || '',
        organization_id: organizationId || '',
        organization_name: '',
        nodes: [],
        total_nodes: 0,
        verified_nodes: 0,
        total_steps: 0,
        verified_steps: 0,
        total_distance_km: 0,
        total_duration_hours: 0,
      })
    } finally {
      setJourneyLoading(false)
    }
  }, [selectedProductId, products, organizationId])

  useEffect(() => {
    void loadJourney()
  }, [loadJourney])

  // Handle product selection
  const handleProductChange = (productId: string) => {
    setSearchParams({ product: productId })
  }

  // Handle journey update (after edit)
  const handleJourneyUpdate = () => {
    void loadJourney()
  }

  if (!organizationId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Организация не найдена</AlertTitle>
          <AlertDescription>
            Пожалуйста, выберите организацию в настройках профиля.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/dashboard/organization/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к товарам
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Цепочка поставок</h1>
            <p className="text-muted-foreground">
              Управление прозрачностью происхождения товаров
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleJourneyUpdate}
              disabled={journeyLoading}
            >
              <RefreshCw className={journeyLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Product Selector */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Выберите товар</CardTitle>
          <CardDescription>
            Цепочка поставок настраивается отдельно для каждого товара
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          ) : products.length === 0 ? (
            <div className="flex items-center gap-4 rounded-lg border border-dashed p-4">
              <Package className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Нет товаров</p>
                <p className="text-sm text-muted-foreground">
                  Сначала добавьте товары в каталог организации
                </p>
              </div>
              <Button asChild className="ml-auto">
                <Link to="/dashboard/organization/products">Добавить товар</Link>
              </Button>
            </div>
          ) : (
            <Select value={selectedProductId || ''} onValueChange={handleProductChange}>
              <SelectTrigger className="w-full sm:w-[400px]">
                <SelectValue placeholder="Выберите товар" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Supply Chain Content */}
      {selectedProductId && journey && (
        <Tabs defaultValue="view" className="space-y-6">
          <TabsList>
            <TabsTrigger value="view">Просмотр</TabsTrigger>
            <TabsTrigger value="map">Карта</TabsTrigger>
            <TabsTrigger value="edit">Редактирование</TabsTrigger>
          </TabsList>

          {/* View Tab */}
          <TabsContent value="view" className="space-y-6">
            <SupplyChainTimeline
              journey={journey}
              defaultExpanded={true}
              title={`Цепочка поставок: ${journey.product_name}`}
            />
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map" className="space-y-6">
            <SupplyChainMap
              journey={journey}
              height="500px"
              title={`География: ${journey.product_name}`}
            />
          </TabsContent>

          {/* Edit Tab */}
          <TabsContent value="edit" className="space-y-6">
            <SupplyChainEditor
              organizationId={organizationId}
              productId={selectedProductId}
              journey={journey}
              onUpdate={handleJourneyUpdate}
            />

            {/* Preview */}
            {journey.nodes.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Предпросмотр</h3>
                <SupplyChainTimeline
                  journey={journey}
                  defaultExpanded={false}
                  title="Как видят клиенты"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Empty State */}
      {selectedProductId && !journeyLoading && journey?.nodes.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Цепочка поставок пуста</h3>
            <p className="mt-1 text-center text-muted-foreground">
              Добавьте узлы (производитель, склад, дистрибьютор и т.д.)
              <br />
              чтобы показать путь товара от производства до потребителя
            </p>
            <Tabs defaultValue="edit" className="mt-6">
              <TabsList>
                <TabsTrigger value="edit">Начать редактирование</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default OrganizationSupplyChainPage
