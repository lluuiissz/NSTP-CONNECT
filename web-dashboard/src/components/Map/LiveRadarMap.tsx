'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from '@/lib/supabase'

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom Icon for Volunteers
const volunteerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

export default function LiveRadarMap() {
  const [volunteers, setVolunteers] = useState<any[]>([])
  
  // Default center: Agusan del Sur
  const center: [number, number] = [8.5065, 125.7562]

  useEffect(() => {
    // Initial fetch of active volunteer logs
    const fetchActiveLogs = async () => {
      const { data, error } = await supabase
        .from('volunteer_logs')
        .select(`
          id,
          lat,
          lng,
          status,
          users (
            full_name
          )
        `)
        .eq('status', 'active')
      
      if (!error && data) {
        setVolunteers(data)
      }
    }
    
    fetchActiveLogs()

    // Realtime subscription
    const channel = supabase
      .channel('volunteer_tracking')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'volunteer_logs',
        filter: "status=eq.active"
      }, (payload) => {
        // Simple strategy: re-fetch all active on any change for this MVP
        fetchActiveLogs()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Live Volunteer Radar</h2>
          <p className="text-slate-500 text-sm">Real-time tracking of active volunteers in your area.</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-green-700">Live Updates Active</span>
        </div>
      </div>
      
      <div className="h-[500px] w-full rounded-xl overflow-hidden border border-slate-300 z-0">
        <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {volunteers.map((vol) => (
            vol.lat && vol.lng && (
              <Marker key={vol.id} position={[vol.lat, vol.lng]} icon={volunteerIcon}>
                <Popup>
                  <div className="font-semibold text-slate-800">
                    {vol.users?.full_name || 'Unknown Volunteer'}
                  </div>
                  <div className="text-xs text-green-600 font-medium">Currently Active</div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
