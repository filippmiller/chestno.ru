import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import type { GeoBreakdownItem } from '@/types/auth'

// Country center coordinates (approximate)
const COUNTRY_COORDINATES: Record<string, [number, number]> = {
  RU: [55.7558, 37.6173], // Moscow
  US: [39.8283, -98.5795],
  DE: [52.52, 13.405],
  FR: [48.8566, 2.3522],
  GB: [51.5074, -0.1278],
  CN: [39.9042, 116.4074],
  IN: [28.6139, 77.209],
  BR: [-15.7801, -47.9292],
  JP: [35.6762, 139.6503],
  KR: [37.5665, 126.978],
  IT: [41.9028, 12.4964],
  ES: [40.4168, -3.7038],
  NL: [52.3676, 4.9041],
  PL: [52.2297, 21.0122],
  UA: [50.4501, 30.5234],
  BY: [53.9006, 27.559],
  KZ: [51.1694, 71.4491],
  UZ: [41.2995, 69.2401],
  TR: [41.0082, 28.9784],
  AU: [-33.8688, 151.2093],
  CA: [45.4215, -75.6972],
}

// Russian city coordinates
const CITY_COORDINATES: Record<string, [number, number]> = {
  'Moscow': [55.7558, 37.6173],
  'Saint Petersburg': [59.9311, 30.3609],
  'Москва': [55.7558, 37.6173],
  'Санкт-Петербург': [59.9311, 30.3609],
  'Novosibirsk': [55.0084, 82.9357],
  'Новосибирск': [55.0084, 82.9357],
  'Yekaterinburg': [56.8389, 60.6057],
  'Екатеринбург': [56.8389, 60.6057],
  'Kazan': [55.7887, 49.1221],
  'Казань': [55.7887, 49.1221],
  'Nizhny Novgorod': [56.2965, 43.9361],
  'Нижний Новгород': [56.2965, 43.9361],
  'Chelyabinsk': [55.1644, 61.4368],
  'Челябинск': [55.1644, 61.4368],
  'Samara': [53.1959, 50.1002],
  'Самара': [53.1959, 50.1002],
  'Omsk': [54.9885, 73.3242],
  'Омск': [54.9885, 73.3242],
  'Rostov-on-Don': [47.2357, 39.7015],
  'Ростов-на-Дону': [47.2357, 39.7015],
  'Ufa': [54.735, 55.9587],
  'Уфа': [54.735, 55.9587],
  'Krasnoyarsk': [56.0153, 92.8932],
  'Красноярск': [56.0153, 92.8932],
  'Voronezh': [51.6755, 39.2089],
  'Воронеж': [51.6755, 39.2089],
  'Perm': [58.0105, 56.2502],
  'Пермь': [58.0105, 56.2502],
  'Volgograd': [48.708, 44.5133],
  'Волгоград': [48.708, 44.5133],
}

function getCoordinates(item: GeoBreakdownItem): [number, number] | null {
  // First try city
  if (item.city) {
    const cityCoords = CITY_COORDINATES[item.city]
    if (cityCoords) return cityCoords
  }

  // Fall back to country
  if (item.country) {
    const countryCoords = COUNTRY_COORDINATES[item.country]
    if (countryCoords) return countryCoords
  }

  return null
}

interface QRGeoMapProps {
  geoBreakdown: GeoBreakdownItem[]
  className?: string
}

export function QRGeoMap({ geoBreakdown, className = '' }: QRGeoMapProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`flex h-64 items-center justify-center rounded-lg border bg-muted ${className}`}>
        <span className="text-sm text-muted-foreground">Загрузка карты...</span>
      </div>
    )
  }

  const markersData = geoBreakdown
    .map((item) => ({
      ...item,
      coords: getCoordinates(item),
    }))
    .filter((item) => item.coords !== null)

  if (markersData.length === 0) {
    return (
      <div className={`flex h-64 items-center justify-center rounded-lg border bg-muted ${className}`}>
        <span className="text-sm text-muted-foreground">Нет географических данных</span>
      </div>
    )
  }

  // Calculate max count for scaling
  const maxCount = Math.max(...markersData.map((m) => m.count))

  // Calculate center based on markers
  const avgLat = markersData.reduce((sum, m) => sum + (m.coords?.[0] ?? 0), 0) / markersData.length
  const avgLng = markersData.reduce((sum, m) => sum + (m.coords?.[1] ?? 0), 0) / markersData.length

  return (
    <div className={`h-64 overflow-hidden rounded-lg border ${className}`}>
      <MapContainer
        center={[avgLat, avgLng]}
        zoom={3}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markersData.map((item, idx) => {
          if (!item.coords) return null
          // Scale radius between 8 and 30 based on count
          const radius = 8 + (item.count / maxCount) * 22
          return (
            <CircleMarker
              key={idx}
              center={item.coords}
              radius={radius}
              fillColor="#3b82f6"
              color="#1d4ed8"
              weight={2}
              opacity={0.8}
              fillOpacity={0.5}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-medium">
                    {item.city ?? 'Неизвестный город'}, {item.country ?? 'N/A'}
                  </div>
                  <div className="text-muted-foreground">{item.count} сканов</div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
