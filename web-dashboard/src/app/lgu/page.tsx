'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

const AnalyticsCharts = dynamic(
  () => import('@/components/Dashboard/AnalyticsCharts'),
  { ssr: false } // Recharts uses browser APIs
)

export default function LguDashboardPage() {
  const [activeVolunteers, setActiveVolunteers] = useState(0)
  const [ongoingActivities, setOngoingActivities] = useState(0)
  const [totalHours, setTotalHours] = useState(0)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch total unique volunteers (users with role 'volunteer')
      const { count: volsCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'volunteer')

      setActiveVolunteers(volsCount || 0)

      // 2. Fetch ongoing activities (event_date >= today)
      const today = new Date().toISOString()
      const { count: actsCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .gte('event_date', today)

      setOngoingActivities(actsCount || 0)

      // 3. Fetch volunteer logs for hours & charts
      const { data: logsData } = await supabase
        .from('volunteer_logs')
        .select('*, activities(municipality)')
        .order('created_at', { ascending: false })

      if (logsData) {
        setLogs(logsData)
        const hours = logsData.reduce((sum, log) => sum + (Number(log.service_hours) || 0), 0)
        setTotalHours(hours)
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-slate-500 mt-1">Real-time metrics, analytics, and volunteer mapping.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="bg-slate-200 h-32 rounded-2xl"></div>
          <div className="bg-slate-200 h-32 rounded-2xl"></div>
          <div className="bg-slate-200 h-32 rounded-2xl"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Stats */}
          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-md flex flex-col justify-between">
            <div>
              <h3 className="text-blue-200 font-medium mb-1">Registered Volunteers</h3>
              <p className="text-4xl font-bold">{activeVolunteers}</p>
            </div>
            <div className="mt-4 text-sm text-blue-200 bg-blue-700/50 inline-block px-3 py-1 rounded-full w-max">
              Ready to deploy
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-slate-500 font-medium mb-1">Upcoming Activities</h3>
              <p className="text-4xl font-bold text-slate-800">{ongoingActivities}</p>
            </div>
            <div className="mt-4 text-sm text-slate-600 bg-slate-100 inline-block px-3 py-1 rounded-full w-max">
              Scheduled from today
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-slate-500 font-medium mb-1">Total Hours Logged</h3>
              <p className="text-4xl font-bold text-slate-800">{totalHours.toFixed(1)}</p>
            </div>
            <div className="mt-4 text-sm text-slate-600 bg-slate-100 inline-block px-3 py-1 rounded-full w-max">
              Across all municipalities
            </div>
          </div>
        </div>
      )}

      {/* Analytics Charts Component */}
      {!loading && logs.length > 0 && (
        <AnalyticsCharts logs={logs} />
      )}

      {/* Main Map Area */}
      <Suspense fallback={<div>Loading map component...</div>}>
        <LiveRadarMap />
      </Suspense>
    </div>
  )
}
