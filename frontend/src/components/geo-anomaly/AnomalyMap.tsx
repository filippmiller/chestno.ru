import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import type { GeographicAnomaly } from '@/types/geoAnomaly'

const SEVERITY_COLORS: Record<string, string> = {
  low: '#eab308',      // yellow
  medium: '#f97316',   // orange
  high: '#ef4444',     // red
  critical: '#991b1b', // dark red
}

interface MapBoundsProps {
  anomalies: GeographicAnomaly[]
}

function MapBounds({ anomalies }: MapBoundsProps) {
  const map = useMap()

  useEffect(() => {
    const validAnomalies = anomalies.filter(a => a.scan_lat && a.scan_lng)
    if (validAnomalies.length > 0) {
      const bounds = L.latLngBounds(
        validAnomalies.map(a => [a.scan_lat!, a.scan_lng!] as [number, number])
      )
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [anomalies, map])

  return null
}

interface AnomalyMapProps {
  anomalies: GeographicAnomaly[]
  onAnomalyClick?: (anomaly: GeographicAnomaly) => void
  className?: string
  height?: string
}

export function AnomalyMap({
  anomalies,
  onAnomalyClick,
  className = '',
  height = '400px'
}: AnomalyMapProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border bg-muted ${className}`}
        style={{ height }}
      >
        <span className="text-sm text-muted-foreground">Загрузка карты...</span>
      </div>
    )
  }

  const validAnomalies = anomalies.filter(a => a.scan_lat && a.scan_lng)

  if (validAnomalies.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border bg-muted ${className}`}
        style={{ height }}
      >
        <span className="text-sm text-muted-foreground">
          Нет данных о местоположении аномалий
        </span>
      </div>
    )
  }

  // Calculate center
  const avgLat = validAnomalies.reduce((sum, a) => sum + (a.scan_lat ?? 0), 0) / validAnomalies.length
  const avgLng = validAnomalies.reduce((sum, a) => sum + (a.scan_lng ?? 0), 0) / validAnomalies.length

  return (
    <div className={`overflow-hidden rounded-lg border ${className}`} style={{ height }}>
      <MapContainer
        center={[avgLat, avgLng]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds anomalies={validAnomalies} />

        {validAnomalies.map((anomaly) => (
          <CircleMarker
            key={anomaly.id}
            center={[anomaly.scan_lat!, anomaly.scan_lng!]}
            radius={getSeverityRadius(anomaly.severity)}
            pathOptions={{
              color: SEVERITY_COLORS[anomaly.severity] || '#ef4444',
              fillColor: SEVERITY_COLORS[anomaly.severity] || '#ef4444',
              fillOpacity: 0.6,
              weight: 2
            }}
            eventHandlers={{
              click: () => onAnomalyClick?.(anomaly)
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="font-semibold text-red-600">
                  Аномалия: {anomaly.actual_region_name || anomaly.actual_region}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Ожидался: {anomaly.expected_region}
                </div>
                {anomaly.product_name && (
                  <div className="text-sm mt-2">
                    Продукт: {anomaly.product_name}
                  </div>
                )}
                {anomaly.distance_from_authorized_km && (
                  <div className="text-sm">
                    Расстояние: {anomaly.distance_from_authorized_km} км
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: SEVERITY_COLORS[anomaly.severity] }}
                  />
                  <span className="text-xs capitalize">{anomaly.severity}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(anomaly.created_at).toLocaleString('ru-RU')}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

function getSeverityRadius(severity: string): number {
  switch (severity) {
    case 'critical':
      return 15
    case 'high':
      return 12
    case 'medium':
      return 9
    case 'low':
    default:
      return 7
  }
}

interface AnomalyHeatmapProps {
  anomalies: GeographicAnomaly[]
  className?: string
  height?: string
}

export function AnomalyHeatmap({ anomalies, className = '', height = '300px' }: AnomalyHeatmapProps) {
  // Group anomalies by region for a simplified heatmap view
  const regionCounts = anomalies.reduce((acc, anomaly) => {
    const region = anomaly.actual_region
    acc[region] = (acc[region] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sortedRegions = Object.entries(regionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  if (sortedRegions.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border bg-muted ${className}`}
        style={{ height }}
      >
        <span className="text-sm text-muted-foreground">
          Нет данных для отображения
        </span>
      </div>
    )
  }

  const maxCount = Math.max(...sortedRegions.map(([, count]) => count))

  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`} style={{ minHeight: height }}>
      <h4 className="text-sm font-medium mb-3">Топ регионов с аномалиями</h4>
      <div className="space-y-2">
        {sortedRegions.map(([region, count]) => {
          const percentage = (count / maxCount) * 100
          const anomaly = anomalies.find(a => a.actual_region === region)
          const regionName = anomaly?.actual_region_name || region

          return (
            <div key={region} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{regionName}</span>
                <span className="font-medium">{count}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
