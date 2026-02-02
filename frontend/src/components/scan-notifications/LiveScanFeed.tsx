/**
 * LiveScanFeed Component
 *
 * Real-time display of product scan events for producers.
 * Supports WebSocket connection for live updates and polling fallback.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Activity,
  AlertTriangle,
  Globe,
  MapPin,
  Package,
  RefreshCw,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { LiveScanFeedItem, WebSocketScanEvent } from '@/types/scan-notifications'

interface LiveScanFeedProps {
  organizationId: string
  initialItems?: LiveScanFeedItem[]
  autoRefresh?: boolean
  refreshInterval?: number
  maxItems?: number
  showStats?: boolean
  onItemClick?: (item: LiveScanFeedItem) => void
}

export function LiveScanFeed({
  organizationId,
  initialItems = [],
  autoRefresh = true,
  refreshInterval = 30000,
  maxItems = 50,
  showStats = true,
  onItemClick,
}: LiveScanFeedProps) {
  const [items, setItems] = useState<LiveScanFeedItem[]>(initialItems)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch initial data and setup polling
  const fetchFeed = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/scan-notifications/live-feed?limit=${maxItems}`,
        { credentials: 'include' }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch scan feed')
      }

      const data = await response.json()
      setItems(data.items)
    } catch (err) {
      console.error('Error fetching scan feed:', err)
      setError('Не удалось загрузить ленту сканирований')
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, maxItems])

  // Setup WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/organizations/${organizationId}/scan-notifications/ws`

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[LiveScanFeed] WebSocket connected')
        setIsConnected(true)
        setError(null)
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketScanEvent = JSON.parse(event.data)

          if (message.type === 'scan' && message.data) {
            setItems((prev) => {
              // Add new item to the beginning
              const updated = [message.data!, ...prev]
              // Keep only maxItems
              return updated.slice(0, maxItems)
            })
          }
        } catch (err) {
          console.error('[LiveScanFeed] Error parsing WebSocket message:', err)
        }
      }

      ws.onclose = () => {
        console.log('[LiveScanFeed] WebSocket disconnected')
        setIsConnected(false)

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket()
        }, 5000)
      }

      ws.onerror = (err) => {
        console.error('[LiveScanFeed] WebSocket error:', err)
        setIsConnected(false)
      }

      wsRef.current = ws
    } catch (err) {
      console.error('[LiveScanFeed] Error creating WebSocket:', err)
      setIsConnected(false)
    }
  }, [organizationId, maxItems])

  // Initial fetch and WebSocket setup
  useEffect(() => {
    fetchFeed()
    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [fetchFeed, connectWebSocket])

  // Polling fallback when WebSocket is not connected
  useEffect(() => {
    if (!autoRefresh || isConnected) return

    const interval = setInterval(fetchFeed, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, isConnected, refreshInterval, fetchFeed])

  // Calculate stats
  const stats = {
    total: items.length,
    suspicious: items.filter((i) => i.is_suspicious).length,
    firstScans: items.filter((i) => i.is_first_scan).length,
    newRegions: items.filter((i) => i.is_new_region).length,
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Лента сканирований</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`p-1.5 rounded-full ${isConnected ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {isConnected ? (
                      <Wifi className="h-4 w-4 text-green-600" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {isConnected ? 'Подключено в реальном времени' : 'Автообновление каждые 30 сек'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchFeed}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {showStats && (
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              {stats.total} сканирований
            </Badge>
            {stats.suspicious > 0 && (
              <Badge variant="destructive" className="text-xs">
                {stats.suspicious} подозрительных
              </Badge>
            )}
            {stats.firstScans > 0 && (
              <Badge className="bg-green-100 text-green-800 text-xs">
                {stats.firstScans} первых
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0">
        {error && (
          <div className="px-4 py-3 bg-red-50 text-red-800 text-sm">
            {error}
          </div>
        )}

        {isLoading && items.length === 0 ? (
          <div className="space-y-3 p-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-3 opacity-50" />
            <p>Пока нет сканирований</p>
            <p className="text-sm">Они появятся здесь в реальном времени</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {items.map((item) => (
                <ScanFeedItem
                  key={item.id}
                  item={item}
                  onClick={onItemClick ? () => onItemClick(item) : undefined}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// Individual feed item component
interface ScanFeedItemProps {
  item: LiveScanFeedItem
  onClick?: () => void
}

function ScanFeedItem({ item, onClick }: ScanFeedItemProps) {
  const timeAgo = formatDistanceToNow(new Date(item.scanned_at), {
    addSuffix: true,
    locale: ru,
  })

  const location = [item.city, item.country].filter(Boolean).join(', ') || 'Неизвестно'

  return (
    <div
      className={`p-4 hover:bg-accent/50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${
        item.is_suspicious ? 'bg-red-50/50' : item.is_first_scan ? 'bg-green-50/50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${
          item.is_suspicious
            ? 'bg-red-100'
            : item.is_first_scan
            ? 'bg-green-100'
            : item.is_new_region
            ? 'bg-yellow-100'
            : 'bg-blue-100'
        }`}>
          {item.is_suspicious ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : item.is_first_scan ? (
            <Sparkles className="h-4 w-4 text-green-600" />
          ) : item.is_new_region ? (
            <Globe className="h-4 w-4 text-yellow-600" />
          ) : (
            <Package className="h-4 w-4 text-blue-600" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {item.product_name || 'Продукт'}
            </span>
            {item.is_first_scan && (
              <Badge className="bg-green-100 text-green-800 text-xs">
                Первое
              </Badge>
            )}
            {item.is_suspicious && (
              <Badge variant="destructive" className="text-xs">
                Подозрительное
              </Badge>
            )}
            {item.is_new_region && (
              <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                Новый регион
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {location}
            </span>
            {item.batch_code && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {item.batch_code}
              </span>
            )}
          </div>
        </div>

        {/* Time */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {timeAgo}
        </span>
      </div>
    </div>
  )
}
