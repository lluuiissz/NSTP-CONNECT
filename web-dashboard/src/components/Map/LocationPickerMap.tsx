'use client'

import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom Icon for Event / Incident location
const eventIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  const prevCenterRef = useRef<[number, number]>(center)

  useEffect(() => {
    if (center[0] !== prevCenterRef.current[0] || center[1] !== prevCenterRef.current[1]) {
      prevCenterRef.current = center
      map.flyTo(center, zoom, { duration: 1.0 })
    }
  }, [center, zoom, map])

  return null
}

function LocationMarker({
  position,
  setPosition,
}: {
  position: L.LatLng | null
  setPosition: (pos: L.LatLng) => void
}) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng)
    },
  })

  if (!position) return null

  return (
    <Marker
      position={position}
      icon={eventIcon}
      draggable={true}
      eventHandlers={{
        dragend(e) {
          const marker = e.target
          if (marker) {
            setPosition(marker.getLatLng())
          }
        },
      }}
    />
  )
}

export interface LocationPickerMapProps {
  onLocationSelect: (lat: number, lng: number) => void
  initialLat?: number | null
  initialLng?: number | null
  center?: [number, number]
  zoom?: number
  heightClass?: string
  placeholderText?: string
  onClear?: () => void
}

export default function LocationPickerMap({
  onLocationSelect,
  initialLat,
  initialLng,
  center = [8.5065, 125.7562],
  zoom = 11,
  heightClass = 'h-[360px]',
  placeholderText,
  onClear,
}: LocationPickerMapProps) {
  const [position, setPosition] = useState<L.LatLng | null>(() => {
    if (initialLat != null && initialLng != null && initialLat !== 0 && initialLng !== 0) {
      return new L.LatLng(initialLat, initialLng)
    }
    return null
  })

  // Synchronize if initialLat/initialLng changes from parent
  useEffect(() => {
    if (initialLat != null && initialLng != null && initialLat !== 0 && initialLng !== 0) {
      setPosition(new L.LatLng(initialLat, initialLng))
    } else if (initialLat === null && initialLng === null) {
      setPosition(null)
    }
  }, [initialLat, initialLng])

  const handlePositionChange = (latlng: L.LatLng) => {
    setPosition(latlng)
    onLocationSelect(latlng.lat, latlng.lng)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPosition(null)
    onClear?.()
  }

  return (
    <div className={`${heightClass} w-full rounded-2xl overflow-hidden border border-slate-300 z-0 relative group shadow-inner`}>
      {/* Top Floating Helper Overlay */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md border border-white/10 pointer-events-auto">
          {position
            ? `📍 Pin: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)} (Drag to fine-tune)`
            : (placeholderText || '👇 Click anywhere on the map to pin exact location')}
        </div>

        {position && onClear && (
          <button
            type="button"
            onClick={handleClear}
            className="pointer-events-auto bg-white/95 hover:bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-slate-200 transition-all active:scale-95 hover:text-red-600"
          >
            Clear Pin
          </button>
        )}
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="cursor-crosshair"
      >
        <MapViewController center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} setPosition={handlePositionChange} />
      </MapContainer>
    </div>
  )
}
