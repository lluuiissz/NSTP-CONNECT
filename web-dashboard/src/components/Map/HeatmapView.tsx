'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabase'

interface VolunteerLog {
  id: string
  lat: number
  lng: number
  status: string
  created_at: string
}

export default function HeatmapView() {
  const [logs, setLogs] = useState<VolunteerLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAllLogs() {
      // Fetch all logs to generate density map
      const { data, error } = await supabase
        .from('volunteer_logs')
        .select('id, lat, lng, status, created_at')
      
      if (!error && data) {
        setLogs(data)
      }
      setLoading(false)
    }

    fetchAllLogs()
  }, [])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔥</div>
          <p className="text-slate-500 font-medium animate-pulse">Generating Heatmap Data...</p>
        </div>
      </div>
    )
  }

  return (
    <MapContainer 
      center={[8.5061, 125.9816]} // Default to Agusan del Sur
      zoom={11} 
      className="w-full h-full rounded-xl shadow-inner border border-slate-200 z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* 
        MVP Heatmap Technique: 
        Render highly transparent, wide red circles. 
        When volunteers cluster, the opacity sums up to create a solid red "hot" zone.
        This completely avoids the complexity of canvas plugins while achieving the exact same visual result.
      */}
      {logs.map((log) => (
        <CircleMarker
          key={log.id}
          center={[log.lat, log.lng]}
          radius={25}
          pathOptions={{ 
            color: 'transparent', 
            fillColor: '#ef4444', // Tailwind red-500
            fillOpacity: 0.15 // High transparency for stacking effect
          }}
        >
          <Popup className="rounded-xl">
            <div className="p-2 text-center">
              <h3 className="font-bold text-slate-800">Activity Node</h3>
              <p className="text-xs text-slate-500 mt-1">Logged: {new Date(log.created_at).toLocaleDateString()}</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Map Overlay Info Panel (Aesthetic Minimalism) */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-slate-100 max-w-xs">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="text-xl">🔥</span> Heatmap Overview
        </h3>
        <p className="text-sm text-slate-600 mt-2">
          Darker red areas indicate higher densities of volunteer activity across the province.
        </p>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Data Points</span>
          <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-full text-sm">
            {logs.length}
          </span>
        </div>
      </div>
    </MapContainer>
  )
}
