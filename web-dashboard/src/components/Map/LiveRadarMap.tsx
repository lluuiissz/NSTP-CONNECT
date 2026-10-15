'use client'

import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from '@/lib/supabase'

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom Icon for Active Volunteers (Green)
const activeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Custom Icon for Inactive/Completed Volunteers (Gray)
const inactiveIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

interface RadarVolunteer {
  id: string
  lat: number | null
  lng: number | null
  status: string
  service_hours: number | null
  created_at: string
  users: {
    full_name: string | null
    mobile_number: string | null
    nstp_component: string | null
    barangay: string | null
    municipality: string | null
  } | null
}

// Supabase types embedded joins as arrays by default; normalize to a single object.
type RawLog = {
  id: string
  lat: number | null
  lng: number | null
  status: string
  service_hours: number | null
  created_at: string
  users: {
    full_name: string | null
    mobile_number: string | null
    nstp_component: string | null
    barangay: string | null
    municipality: string | null
  } | {
    full_name: string | null
    mobile_number: string | null
    nstp_component: string | null
    barangay: string | null
    municipality: string | null
  }[] | null
}

export default function LiveRadarMap() {
  const [volunteers, setVolunteers] = useState<RadarVolunteer[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Default center: Agusan del Sur
  const center: [number, number] = [8.5065, 125.7562]

  const startOfToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }

  // Full fetch — used once on mount and as a safety net when a delta
  // arrives for a log we don't have (e.g. changed while we were offline).
  const fetchLogs = useCallback(async () => {
    let { data, error } = await supabase
      .from('volunteer_logs')
      .select(`
        id,
        lat,
        lng,
        status,
        service_hours,
        created_at,
        users (
          full_name,
          mobile_number,
          nstp_component,
          barangay,
          municipality
        )
      `)
      .gte('created_at', startOfToday())

    // If mobile_number column has not been migrated yet, fallback without it
    if (error && (error.message?.includes('mobile_number') || error.code === '42703')) {
      const fallback = await supabase
        .from('volunteer_logs')
        .select(`
          id,
          lat,
          lng,
          status,
          service_hours,
          created_at,
          users (
            full_name,
            nstp_component,
            barangay,
            municipality
          )
        `)
        .gte('created_at', startOfToday())
      data = fallback.data as typeof data
      error = fallback.error
    }

    if (!error && data) {
      const rows = (data as unknown as RawLog[]).map((r) => ({
        ...r,
        users: Array.isArray(r.users) ? r.users[0] ?? null : r.users,
      }))
      setVolunteers(rows)
      setLastUpdated(new Date())
    }
  }, [])

  // Fetch the joined user profile for a single log (used by delta handling,
  // because realtime payloads don't include the users join).
  const fetchUserForLog = useCallback(async (userId: string) => {
    const { data: initialData, error } = await supabase
      .from('users')
      .select('full_name, mobile_number, nstp_component, barangay, municipality')
      .eq('id', userId)
      .single()

    let data = initialData

    if (error && (error.message?.includes('mobile_number') || error.code === '42703')) {
      const fallback = await supabase
        .from('users')
        .select('full_name, nstp_component, barangay, municipality')
        .eq('id', userId)
        .single()
      data = fallback.data ? { ...fallback.data, mobile_number: null } : null
    }

    return data
  }, [])

  useEffect(() => {
    // Defer initial fetch so we never setState synchronously inside the effect body
    const t = setTimeout(fetchLogs, 0);

    // Realtime: apply each change as a delta instead of refetching everything.
    // volunteer_logs updates fire when volunteers move (GPS pings) or stop
    // tracking, so this keeps the radar smooth at any volunteer count.
    const channel = supabase
      .channel('volunteer_tracking')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'volunteer_logs' },
        (payload) => {
          const row = payload.new as { id: string; user_id: string; lat: number | null; lng: number | null; status: string; service_hours: number | null; created_at: string }
          fetchUserForLog(row.user_id).then((user) => {
            setVolunteers((prev) => {
              if (prev.some((v) => v.id === row.id)) return prev
              return [...prev, { ...row, users: user }]
            })
            setLastUpdated(new Date())
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'volunteer_logs' },
        (payload) => {
          const row = payload.new as { id: string; user_id: string; lat: number | null; lng: number | null; status: string; service_hours: number | null; created_at: string }
          setVolunteers((prev) => {
            const existing = prev.find((v) => v.id === row.id)
            if (!existing) {
              // Unknown log (e.g. created while we were disconnected) — fall back
              // to a full refetch to resync.
              fetchLogs()
              return prev
            }
            return prev.map((v) =>
              v.id === row.id ? { ...v, lat: row.lat, lng: row.lng, status: row.status, service_hours: row.service_hours } : v
            )
          })
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'volunteer_logs' },
        (payload) => {
          const old = payload.old as { id: string }
          setVolunteers((prev) => prev.filter((v) => v.id !== old.id))
          setLastUpdated(new Date())
        }
      )
      .subscribe()

    return () => {
      clearTimeout(t)
      supabase.removeChannel(channel)
    }
  }, [fetchLogs, fetchUserForLog])

  const activeCount = volunteers.filter(v => v.status === 'active').length

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Live Volunteer Radar</h2>
          <p className="text-slate-500 text-sm">Real-time tracking of today&apos;s volunteers.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium text-green-700">{activeCount} Live Now</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1">
            <span className="h-3 w-3 rounded-full bg-slate-400"></span>
            <span className="text-xs font-medium text-slate-500">Completed Today</span>
          </div>
          {lastUpdated && (
            <div className="text-xs text-slate-400">
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
      
      <div className="h-[500px] w-full rounded-xl overflow-hidden border border-slate-300 z-0 relative">
        <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {volunteers.map((vol) => (
            vol.lat && vol.lng && (
              <Marker 
                key={vol.id} 
                position={[vol.lat, vol.lng]} 
                icon={vol.status === 'active' ? activeIcon : inactiveIcon}
              >
                <Popup className="attendance-popup">
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">
                          {vol.users?.full_name || 'Volunteer'}
                        </h4>
                        {(vol.users?.barangay || vol.users?.municipality) && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {[vol.users?.barangay, vol.users?.municipality].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      {vol.users?.nstp_component && (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                          {vol.users.nstp_component}
                        </span>
                      )}
                    </div>

                    {/* Attendance Verification & Mobile Call */}
                    <div className="my-2">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Attendance Contact
                      </div>
                      {vol.users?.mobile_number ? (
                        <a
                          href={`tel:${vol.users.mobile_number}`}
                          className="flex items-center justify-center gap-1.5 w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-all shadow-sm"
                          title="Call volunteer for attendance verification"
                        >
                          <span>📞</span>
                          <span>Call: {vol.users.mobile_number}</span>
                        </a>
                      ) : (
                        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>No mobile number registered</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      {vol.status === 'active' ? (
                        <div className="text-green-600 font-bold flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          Currently Active
                        </div>
                      ) : (
                        <div className="text-slate-500 font-medium">
                          Completed: <strong className="text-slate-700">{vol.service_hours} hrs</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
