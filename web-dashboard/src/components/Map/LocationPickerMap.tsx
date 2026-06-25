'use client'

import { useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom Icon for Event location
const eventIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng)
    },
  })

  return position === null ? null : (
    <Marker position={position} icon={eventIcon}></Marker>
  )
}

interface LocationPickerMapProps {
  onLocationSelect: (lat: number, lng: number) => void
}

export default function LocationPickerMap({ onLocationSelect }: LocationPickerMapProps) {
  const [position, setPosition] = useState<L.LatLng | null>(null)
  
  // Default center: Agusan del Sur
  const center: [number, number] = [8.5065, 125.7562]

  const handlePositionChange = (latlng: L.LatLng) => {
    setPosition(latlng)
    onLocationSelect(latlng.lat, latlng.lng)
  }

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border-2 border-slate-300 z-0 relative group">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/80 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg pointer-events-none backdrop-blur-sm">
        {position ? '📍 Location Saved' : '👇 Tap on the map to set location'}
      </div>
      
      <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }} className="cursor-crosshair">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} setPosition={handlePositionChange} />
      </MapContainer>
    </div>
  )
}
