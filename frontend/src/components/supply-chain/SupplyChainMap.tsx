import { useEffect, useRef, useState } from 'react'
import { MapPin, Maximize2, Minimize2, Navigation } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type {
  SupplyChainJourney,
  SupplyChainNode as SupplyChainNodeType,
} from '@/types/supply-chain'
import { NodeColors, NodeLabels } from './SupplyChainNode'

export interface SupplyChainMapProps {
  journey: SupplyChainJourney
  title?: string
  description?: string
  height?: string
  onNodeClick?: (node: SupplyChainNodeType) => void
  className?: string
}

// Leaflet types (loaded dynamically)
interface LeafletMap {
  setView: (center: [number, number], zoom: number) => void
  fitBounds: (bounds: [[number, number], [number, number]], options?: unknown) => void
  remove: () => void
}

interface LeafletMarker {
  addTo: (map: LeafletMap) => LeafletMarker
  bindPopup: (content: string) => LeafletMarker
  on: (event: string, handler: () => void) => LeafletMarker
}

interface LeafletPolyline {
  addTo: (map: LeafletMap) => LeafletPolyline
}

interface LeafletIcon {
  // Icon instance
}

declare global {
  interface Window {
    L?: {
      map: (element: HTMLElement, options?: unknown) => LeafletMap
      tileLayer: (url: string, options?: unknown) => { addTo: (map: LeafletMap) => void }
      marker: (latlng: [number, number], options?: unknown) => LeafletMarker
      polyline: (latlngs: [number, number][], options?: unknown) => LeafletPolyline
      divIcon: (options: unknown) => LeafletIcon
      latLngBounds: (points: [number, number][]) => [[number, number], [number, number]]
    }
  }
}

/**
 * Geographic map visualization of the supply chain.
 * Shows nodes as markers on a map with connecting lines.
 * Uses Leaflet for map rendering.
 */
export function SupplyChainMap({
  journey,
  title = 'География поставок',
  description = 'Карта всех точек в цепочке поставок',
  height = '400px',
  onNodeClick,
  className,
}: SupplyChainMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get nodes with coordinates
  const nodesWithCoords = journey.nodes
    .map((jn) => jn.node)
    .filter((node) => node.coordinates?.lat != null && node.coordinates?.lng != null)

  useEffect(() => {
    // Skip if no nodes with coordinates
    if (nodesWithCoords.length === 0) {
      setIsLoading(false)
      return
    }

    // Load Leaflet dynamically
    const loadLeaflet = async () => {
      try {
        // Check if already loaded
        if (window.L) {
          initMap()
          return
        }

        // Load CSS
        const cssLink = document.createElement('link')
        cssLink.rel = 'stylesheet'
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(cssLink)

        // Load JS
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.onload = () => {
          initMap()
        }
        script.onerror = () => {
          setError('Не удалось загрузить карту')
          setIsLoading(false)
        }
        document.body.appendChild(script)
      } catch (err) {
        console.error('Failed to load Leaflet:', err)
        setError('Ошибка загрузки карты')
        setIsLoading(false)
      }
    }

    const initMap = () => {
      if (!mapContainerRef.current || !window.L) return

      try {
        // Clean up existing map
        if (mapRef.current) {
          mapRef.current.remove()
        }

        const L = window.L

        // Create map
        const map = L.map(mapContainerRef.current, {
          scrollWheelZoom: false,
        })

        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)

        // Collect all coordinates for bounds
        const points: [number, number][] = []

        // Add markers for each node
        nodesWithCoords.forEach((node, idx) => {
          if (!node.coordinates) return

          const coords: [number, number] = [node.coordinates.lat, node.coordinates.lng]
          points.push(coords)

          const colors = NodeColors[node.node_type]
          const label = NodeLabels[node.node_type]

          // Create custom icon
          const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `
              <div class="relative">
                <div class="${cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-md',
                  colors.bg,
                  node.is_verified ? 'border-green-500' : 'border-gray-300'
                )}" style="background-color: ${getComputedStyle(document.documentElement).getPropertyValue('--' + colors.bg.split('-')[1] + '-100') || '#f0fdf4'};">
                  <span class="text-xs font-bold">${idx + 1}</span>
                </div>
                ${
                  node.is_verified
                    ? '<div class="absolute -right-1 -bottom-1 h-3 w-3 rounded-full bg-green-500 border border-white"></div>'
                    : ''
                }
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
          })

          // Create marker
          const marker = L.marker(coords, { icon })
            .addTo(map)
            .bindPopup(`
              <div class="p-2">
                <div class="font-semibold">${node.name}</div>
                <div class="text-xs text-gray-500">${label}</div>
                ${node.location ? `<div class="text-xs mt-1">${node.location}</div>` : ''}
                ${
                  node.is_verified
                    ? '<div class="text-xs text-green-600 mt-1">Верифицировано</div>'
                    : ''
                }
              </div>
            `)

          if (onNodeClick) {
            marker.on('click', () => onNodeClick(node))
          }
        })

        // Draw lines between consecutive nodes
        for (let i = 0; i < nodesWithCoords.length - 1; i++) {
          const from = nodesWithCoords[i]
          const to = nodesWithCoords[i + 1]
          if (!from.coordinates || !to.coordinates) continue

          L.polyline(
            [
              [from.coordinates.lat, from.coordinates.lng],
              [to.coordinates.lat, to.coordinates.lng],
            ],
            {
              color: '#6366f1',
              weight: 2,
              opacity: 0.6,
              dashArray: '5, 10',
            }
          ).addTo(map)
        }

        // Fit bounds to show all markers
        if (points.length > 0) {
          const bounds = L.latLngBounds(points)
          map.fitBounds(bounds, { padding: [50, 50] })
        }

        mapRef.current = map
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to initialize map:', err)
        setError('Ошибка инициализации карты')
        setIsLoading(false)
      }
    }

    loadLeaflet()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [nodesWithCoords, onNodeClick])

  // Handle fullscreen toggle
  useEffect(() => {
    if (mapRef.current) {
      // Resize map when fullscreen changes
      setTimeout(() => {
        if (mapRef.current) {
          // Force map resize
          window.dispatchEvent(new Event('resize'))
        }
      }, 100)
    }
  }, [isFullscreen])

  // No nodes with coordinates
  if (nodesWithCoords.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed bg-muted/50">
            <div className="text-center text-muted-foreground">
              <Navigation className="mx-auto h-8 w-8 opacity-50" />
              <p className="mt-2 text-sm">Нет данных о географии</p>
              <p className="text-xs">Координаты не указаны для узлов цепочки</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(isFullscreen && 'fixed inset-4 z-50', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="shrink-0"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap gap-2">
          {nodesWithCoords.map((node, idx) => {
            const colors = NodeColors[node.node_type]
            return (
              <Badge
                key={node.id}
                variant="outline"
                className={cn('text-xs', colors.bg)}
              >
                <span className="mr-1 font-bold">{idx + 1}</span>
                {node.name}
              </Badge>
            )
          })}
        </div>
      </CardHeader>

      <CardContent>
        <div
          ref={mapContainerRef}
          className={cn(
            'relative overflow-hidden rounded-lg border',
            isFullscreen ? 'h-[calc(100%-8rem)]' : ''
          )}
          style={{ height: isFullscreen ? undefined : height }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <div className="text-center text-muted-foreground">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="mt-2 text-sm">Загрузка карты...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <div className="text-center text-muted-foreground">
                <MapPin className="mx-auto h-8 w-8 opacity-50" />
                <p className="mt-2 text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
