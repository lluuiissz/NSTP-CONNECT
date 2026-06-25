'use client'

import dynamic from 'next/dynamic'

// Next.js SSR must be disabled for Leaflet components
const HeatmapView = dynamic(() => import('@/components/Map/HeatmapView'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-slate-100 animate-pulse rounded-xl flex items-center justify-center border border-slate-200">
      <div className="text-center">
        <div className="text-4xl mb-2">🔥</div>
        <p className="text-slate-400 font-medium">Initializing Map Engine...</p>
      </div>
    </div>
  )
})

export default function HeatmapPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <span className="text-red-500">🔥</span>
          Volunteer Heatmap
        </h1>
        <p className="text-lg text-slate-500 mt-2">
          Visualize historical volunteer density across all barangays and municipalities.
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="h-[600px] w-full">
          <HeatmapView />
        </div>
      </div>
    </div>
  )
}
