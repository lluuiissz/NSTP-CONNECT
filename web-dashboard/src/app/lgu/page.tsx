'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// Dynamically import the map to avoid SSR issues with Leaflet
const LiveRadarMap = dynamic(
  () => import('@/components/Map/LiveRadarMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[580px] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-500 font-medium">Loading Map Radar...</p>
      </div>
    )
  }
)

export default function LguDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-slate-500 mt-1">Monitor volunteer activities and coordinate response efforts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Stats - Aesthetic Minimalism (Clear metrics) */}
        <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-md">
          <h3 className="text-blue-200 font-medium mb-1">Active Volunteers</h3>
          <p className="text-4xl font-bold">12</p>
          <div className="mt-4 text-sm text-blue-200 bg-blue-700/50 inline-block px-3 py-1 rounded-full">
            Currently in the field
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-slate-500 font-medium mb-1">Ongoing Activities</h3>
          <p className="text-4xl font-bold text-slate-800">3</p>
          <div className="mt-4 text-sm text-slate-600 bg-slate-100 inline-block px-3 py-1 rounded-full">
            Scheduled for today
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-slate-500 font-medium mb-1">Total Hours Logged</h3>
          <p className="text-4xl font-bold text-slate-800">1,240</p>
          <div className="mt-4 text-sm text-slate-600 bg-slate-100 inline-block px-3 py-1 rounded-full">
            Across all municipalities
          </div>
        </div>
      </div>

      {/* Main Map Area */}
      <Suspense fallback={<div>Loading map component...</div>}>
        <LiveRadarMap />
      </Suspense>
    </div>
  )
}
