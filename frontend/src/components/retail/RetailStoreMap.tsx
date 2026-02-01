/**
 * RetailStoreMap Component
 *
 * Interactive map showing store locations with scan density visualization.
 * Displays store markers with clustering and popup details.
 */
import { useEffect, useState, useCallback } from 'react'
import { MapPin, Store, QrCode, CheckCircle, RefreshCw, Filter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getStoresForMap } from '@/api/retailService'

interface MapStore {
  id: string
  name: string
  latitude: number
  longitude: number
  chain_name?: string
  scan_count: number
  is_verified: boolean
}

interface RetailStoreMapProps {
  onStoreSelect?: (storeId: string) => void
  selectedStoreId?: string
  className?: string
}

// Mock map center (Moscow)
const DEFAULT_CENTER = { lat: 55.7558, lng: 37.6173 }

export function RetailStoreMap({
  onStoreSelect,
  selectedStoreId,
  className = '',
}: RetailStoreMapProps) {
  const [stores, setStores] = useState<MapStore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chainFilter, setChainFilter] = useState<string>('all')
  const [hoveredStore, setHoveredStore] = useState<string | null>(null)

  // Extract unique chain names
  const chainNames = Array.from(new Set(stores.map((s) => s.chain_name).filter(Boolean))) as string[]

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getStoresForMap({
        chain_name: chainFilter !== 'all' ? chainFilter : undefined,
      })
      setStores(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки магазинов'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [chainFilter])

  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  // Calculate marker size based on scan count
  const getMarkerSize = (scanCount: number): number => {
    if (scanCount < 10) return 24
    if (scanCount < 50) return 32
    if (scanCount < 100) return 40
    return 48
  }

  // Get marker color based on verification and activity
  const getMarkerColor = (store: MapStore): string => {
    if (!store.is_verified) return 'bg-gray-400'
    if (store.scan_count >= 100) return 'bg-green-500'
    if (store.scan_count >= 50) return 'bg-blue-500'
    if (store.scan_count >= 10) return 'bg-yellow-500'
    return 'bg-orange-400'
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchStores}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Повторить
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={chainFilter} onValueChange={setChainFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Все сети" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все сети</SelectItem>
              {chainNames.map((chain) => (
                <SelectItem key={chain} value={chain}>
                  {chain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={fetchStores} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>

        <div className="ml-auto text-sm text-muted-foreground">
          {stores.length} магазинов
        </div>
      </div>

      {/* Map Container */}
      <Card className="overflow-hidden">
        <div className="relative h-[500px] bg-muted">
          {/* Map placeholder - in production, integrate with Yandex Maps or similar */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground">Загрузка карты...</p>
              </div>
            ) : (
              <div className="relative h-full w-full">
                {/* Simplified map visualization */}
                <div className="absolute inset-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
                  {stores.map((store) => {
                    // Simple position mapping (demo only)
                    const x = ((store.longitude - 37.0) / 1.5) * 100
                    const y = ((56.0 - store.latitude) / 1.0) * 100
                    const size = getMarkerSize(store.scan_count)
                    const isSelected = store.id === selectedStoreId
                    const isHovered = store.id === hoveredStore

                    if (x < 0 || x > 100 || y < 0 || y > 100) return null

                    return (
                      <div
                        key={store.id}
                        className={`
                          absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer
                          transition-all duration-200 z-10
                          ${isSelected || isHovered ? 'z-20 scale-125' : ''}
                        `}
                        style={{ left: `${x}%`, top: `${y}%` }}
                        onClick={() => onStoreSelect?.(store.id)}
                        onMouseEnter={() => setHoveredStore(store.id)}
                        onMouseLeave={() => setHoveredStore(null)}
                      >
                        <div
                          className={`
                            flex items-center justify-center rounded-full shadow-lg
                            ${getMarkerColor(store)}
                            ${isSelected ? 'ring-4 ring-primary ring-offset-2' : ''}
                          `}
                          style={{ width: size, height: size }}
                        >
                          <Store className="h-1/2 w-1/2 text-white" />
                        </div>

                        {/* Tooltip */}
                        {(isHovered || isSelected) && (
                          <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap">
                            <div className="rounded-lg bg-popover px-3 py-2 text-sm shadow-lg">
                              <p className="font-medium">{store.name}</p>
                              {store.chain_name && (
                                <p className="text-xs text-muted-foreground">{store.chain_name}</p>
                              )}
                              <div className="mt-1 flex items-center gap-2 text-xs">
                                <QrCode className="h-3 w-3" />
                                <span>{store.scan_count} сканирований</span>
                                {store.is_verified && (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Map attribution placeholder */}
                <div className="absolute bottom-2 right-2 rounded bg-white/80 px-2 py-1 text-xs text-muted-foreground">
                  Интерактивная карта
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Легенда</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-green-500" />
              <span>100+ сканирований</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-blue-500" />
              <span>50-99 сканирований</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-yellow-500" />
              <span>10-49 сканирований</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-orange-400" />
              <span>&lt;10 сканирований</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-gray-400" />
              <span>Не верифицирован</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store List (mobile alternative) */}
      <Card className="lg:hidden">
        <CardHeader>
          <CardTitle className="text-base">Список магазинов</CardTitle>
          <CardDescription>Нажмите на магазин для просмотра деталей</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[300px] divide-y overflow-y-auto">
            {stores.map((store) => (
              <div
                key={store.id}
                className={`
                  flex cursor-pointer items-center gap-3 py-3 transition-colors hover:bg-muted/50
                  ${store.id === selectedStoreId ? 'bg-primary/5' : ''}
                `}
                onClick={() => onStoreSelect?.(store.id)}
              >
                <div className={`h-3 w-3 rounded-full ${getMarkerColor(store)}`} />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{store.name}</p>
                  {store.chain_name && (
                    <p className="text-xs text-muted-foreground">{store.chain_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {store.scan_count}
                  </Badge>
                  {store.is_verified && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
            ))}
            {stores.length === 0 && !loading && (
              <p className="py-8 text-center text-muted-foreground">
                Магазины не найдены
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default RetailStoreMap
