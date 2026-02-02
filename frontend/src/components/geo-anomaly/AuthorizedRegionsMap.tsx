import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import type { AuthorizedRegion } from '@/types/geoAnomaly'

// Russian region coordinates for map centering
const REGION_COORDINATES: Record<string, [number, number]> = {
  'RU-MOW': [55.7558, 37.6173],
  'RU-SPE': [59.9343, 30.3351],
  'RU-MOS': [55.8154, 37.3645],
  'RU-LEN': [60.1892, 32.3566],
  'RU-KDA': [45.0448, 38.9760],
  'RU-NIZ': [56.3269, 44.0059],
  'RU-SVE': [56.8389, 60.6057],
  'RU-TAT': [55.7898, 49.1221],
  'RU-SAM': [53.1959, 50.1002],
  'RU-ROS': [47.2357, 39.7015],
  'RU-CHE': [55.1644, 61.4368],
  'RU-BA': [54.7388, 55.9721],
  'RU-PER': [58.0105, 56.2502],
  'RU-VOR': [51.6720, 39.1843],
  'RU-VGG': [48.7080, 44.5133],
  'RU-KR': [44.9521, 34.1024],
  'RU-NSK': [55.0084, 82.9357],
  'RU-OMS': [54.9893, 73.3682],
  'RU-TYU': [57.1522, 65.5272],
  'RU-IRK': [52.2870, 104.2890],
  'RU-KEM': [55.3548, 86.0884],
  'RU-KYA': [56.0097, 92.8523],
  'RU-PRI': [43.1056, 131.8735],
  'RU-KHA': [48.4827, 135.0839],
}

// Custom marker icon
const regionIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

interface MapCenterProps {
  regions: AuthorizedRegion[]
}

function MapCenter({ regions }: MapCenterProps) {
  const map = useMap()

  useEffect(() => {
    if (regions.length > 0) {
      const bounds = L.latLngBounds(
        regions
          .filter(r => r.center_lat && r.center_lng)
          .map(r => [r.center_lat!, r.center_lng!] as [number, number])
      )
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [regions, map])

  return null
}

interface AuthorizedRegionsMapProps {
  regions: AuthorizedRegion[]
  onRegionClick?: (region: AuthorizedRegion) => void
  className?: string
  height?: string
}

export function AuthorizedRegionsMap({
  regions,
  onRegionClick,
  className = '',
  height = '400px'
}: AuthorizedRegionsMapProps) {
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

  // Get coordinates for regions
  const regionsWithCoords = regions.map(region => {
    const coords = region.center_lat && region.center_lng
      ? [region.center_lat, region.center_lng] as [number, number]
      : REGION_COORDINATES[region.region_code] || null
    return { ...region, coords }
  }).filter(r => r.coords !== null)

  if (regionsWithCoords.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border bg-muted ${className}`}
        style={{ height }}
      >
        <span className="text-sm text-muted-foreground">
          Нет авторизованных регионов для отображения
        </span>
      </div>
    )
  }

  // Calculate center
  const avgLat = regionsWithCoords.reduce((sum, r) => sum + (r.coords?.[0] ?? 0), 0) / regionsWithCoords.length
  const avgLng = regionsWithCoords.reduce((sum, r) => sum + (r.coords?.[1] ?? 0), 0) / regionsWithCoords.length

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
        <MapCenter regions={regionsWithCoords} />

        {regionsWithCoords.map((region) => (
          <div key={region.id}>
            {/* Show coverage circle */}
            {region.coords && (
              <Circle
                center={region.coords}
                radius={(region.radius_km || 100) * 1000}
                pathOptions={{
                  color: region.is_exclusive ? '#dc2626' : '#16a34a',
                  fillColor: region.is_exclusive ? '#fecaca' : '#bbf7d0',
                  fillOpacity: 0.3,
                  weight: 2
                }}
              />
            )}

            {/* Show marker */}
            {region.coords && (
              <Marker
                position={region.coords}
                icon={regionIcon}
                eventHandlers={{
                  click: () => onRegionClick?.(region)
                }}
              >
                <Popup>
                  <div className="min-w-[150px]">
                    <div className="font-semibold">{region.region_name}</div>
                    <div className="text-xs text-gray-500">{region.region_code}</div>
                    <div className="mt-1 text-sm">
                      Радиус: {region.radius_km || 100} км
                    </div>
                    {region.is_exclusive && (
                      <div className="mt-1 text-xs font-medium text-red-600">
                        Эксклюзивный регион
                      </div>
                    )}
                    {region.notes && (
                      <div className="mt-1 text-xs text-gray-600">{region.notes}</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}
          </div>
        ))}
      </MapContainer>
    </div>
  )
}
