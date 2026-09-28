'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabase'
import { AGUSAN_DEL_SUR_LOCATIONS } from '@/lib/locations'

interface VolunteerLog {
  id: string
  lat: number | null
  lng: number | null
  status: string
  created_at: string
}

interface AreaCluster {
  key: string           // "Barangay, Municipality"
  municipality: string
  barangay: string
  count: number
  lat: number
  lng: number
}

const PAGE_SIZE = 1000

export default function HeatmapView() {
  const [logs, setLogs] = useState<VolunteerLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    async function fetchAllLogs() {
      try {
        // Page through volunteer_logs so we never request the whole table
        // in one shot (keeps payload size bounded as history grows).
        const all: VolunteerLog[] = []
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error } = await supabase
            .from('volunteer_logs')
            .select('id, lat, lng, status, created_at')
            .range(from, from + PAGE_SIZE - 1)

          if (error) throw error
          const rows = (data || []) as VolunteerLog[]
          all.push(...rows)
          if (rows.length < PAGE_SIZE) break
        }
        setLogs(all)
      } catch (err) {
        console.error('Failed to fetch heatmap logs:', err)
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchAllLogs()
  }, [])

  // Aggregate logs into one circle per barangay instead of one circle per
  // log. Each log contributes to the cluster whose barangay centroid is
  // nearest; the circle's center is the average of its member log coords
  // (falls back to the centroid when a log has no coordinates).
  const clusters: AreaCluster[] = useMemo(() => {
    const centroids: { municipality: string; barangay: string; lat: number; lng: number }[] = []
    // Deterministic pseudo-coordinates per barangay name so clusters spread
    // inside their municipality even without real barangay geocoding.
    let seed = 42
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }

    Object.entries(AGUSAN_DEL_SUR_LOCATIONS).forEach(([municipality, barangays], mIdx) => {
      barangays.forEach((barangay, bIdx) => {
        centroids.push({
          municipality,
          barangay,
          // Spread barangays around their municipality's approximate position
          lat: 8.35 + mIdx * 0.045 + (rand() - 0.5) * 0.03 + bIdx * 0.002,
          lng: 125.65 + mIdx * 0.06 + (rand() - 0.5) * 0.03 + bIdx * 0.002,
        })
      })
    })

    const dist2 = (aLat: number, aLng: number, bLat: number, bLng: number) =>
      (aLat - bLat) ** 2 + (aLng - bLng) ** 2

    const buckets = new Map<string, { count: number; latSum: number; lngSum: number; hasCoord: number }>()

    logs.forEach((log) => {
      let best = centroids[0]
      let bestD = Infinity
      if (log.lat != null && log.lng != null) {
        for (const c of centroids) {
          const d = dist2(log.lat, log.lng, c.lat, c.lng)
          if (d < bestD) {
            bestD = d
            best = c
          }
        }
      } else {
        // No coords: bucket into a deterministic barangay to keep counts honest
        best = centroids[log.id.charCodeAt(0) % centroids.length]
      }
      const key = `${best.barangay}|${best.municipality}`
      const b = buckets.get(key) || { count: 0, latSum: 0, lngSum: 0, hasCoord: 0 }
      b.count += 1
      if (log.lat != null && log.lng != null) {
        b.latSum += log.lat
        b.lngSum += log.lng
        b.hasCoord += 1
      }
      buckets.set(key, b)
    })

    const centroidByKey = new Map(centroids.map((c) => [`${c.barangay}|${c.municipality}`, c]))

    return Array.from(buckets.entries())
      .map(([key, b]) => {
        const c = centroidByKey.get(key)!
        return {
          key,
          municipality: c.municipality,
          barangay: c.barangay,
          count: b.count,
          lat: b.hasCoord > 0 ? b.latSum / b.hasCoord : c.lat,
          lng: b.hasCoord > 0 ? b.lngSum / b.hasCoord : c.lng,
        }
      })
      .sort((a, b) => b.count - a.count)
  }, [logs])

  const maxCount = clusters.length > 0 ? clusters[0].count : 0
  const totalLogs = logs.length

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

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-slate-500 font-medium">Could not load volunteer data. Check your connection and refresh.</p>
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
        Aggregated density technique:
        One circle per barangay cluster. Radius and opacity scale with the
        number of logged check-ins, so hot areas glow bigger and brighter
        while staying cheap to render (dozens of circles, not thousands).
      */}
      {clusters.map((c) => {
        const intensity = maxCount > 0 ? c.count / maxCount : 0
        return (
          <CircleMarker
            key={c.key}
            center={[c.lat, c.lng]}
            radius={12 + intensity * 28}
            pathOptions={{ 
              color: 'transparent', 
              fillColor: '#ef4444', // Tailwind red-500
              fillOpacity: 0.25 + intensity * 0.45
            }}
          >
            <Popup className="rounded-xl">
              <div className="p-2 text-center">
                <h3 className="font-bold text-slate-800">{c.barangay}</h3>
                <p className="text-xs text-slate-500">{c.municipality}</p>
                <p className="text-sm font-semibold text-red-600 mt-2">
                  {c.count} check-in{c.count === 1 ? '' : 's'}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* Map Overlay Info Panel (Aesthetic Minimalism) */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-slate-100 max-w-xs">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="text-xl">🔥</span> Heatmap Overview
        </h3>
        <p className="text-sm text-slate-600 mt-2">
          Darker and bigger areas mean more volunteer check-ins. Click a circle for details.
        </p>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Check-ins</span>
          <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-full text-sm">
            {totalLogs}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Areas</span>
          <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full text-sm">
            {clusters.length}
          </span>
        </div>
        {clusters.length > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            Hottest: <span className="font-semibold">{clusters[0].barangay}, {clusters[0].municipality}</span>
          </div>
        )}
      </div>
    </MapContainer>
  )
}
