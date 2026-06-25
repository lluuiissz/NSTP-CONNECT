'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'

const LocationPickerMap = dynamic(
  () => import('@/components/Map/LocationPickerMap'),
  { ssr: false, loading: () => <div className="h-[400px] w-full bg-slate-100 rounded-xl animate-pulse"></div> }
)

export default function LguActivitiesPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [municipality, setMunicipality] = useState('Prosperidad') // default
  const [barangay, setBarangay] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    
    if (!lat || !lng) {
      setErrorMsg('Please tap on the map to set the exact location.')
      return
    }

    setLoading(true)
    
    const { error } = await supabase
      .from('activities')
      .insert([
        {
          title,
          description,
          event_date: new Date(eventDate).toISOString(),
          municipality,
          barangay,
          lat,
          lng
        }
      ])

    if (error) {
      setErrorMsg('Could not save the activity. Please try again.')
    } else {
      setSuccess(true)
      // Reset form
      setTitle('')
      setDescription('')
      setEventDate('')
      setBarangay('')
      // Map reset requires more complex ref handling, MVP will just show success
    }
    
    setLoading(false)
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-white p-12 rounded-3xl shadow-sm border border-green-200 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Activity Created!</h2>
        <p className="text-slate-500 mb-8">Volunteers in {municipality} will now see this on their app.</p>
        <button 
          onClick={() => setSuccess(false)}
          className="bg-green-50 text-green-700 font-bold py-3 px-8 rounded-xl border border-green-200 hover:bg-green-100 transition-colors"
        >
          Create Another Activity
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create New Activity</h1>
        <p className="text-slate-500 mt-2">Publish a new volunteer opportunity. No coordinates needed—just tap the map!</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <form onSubmit={handleCreateActivity} className="p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Event Title</label>
                <input 
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g. Tree Planting Drive"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Date & Time</label>
                <input 
                  type="datetime-local"
                  required
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Municipality</label>
                  <select 
                    value={municipality}
                    onChange={e => setMunicipality(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Prosperidad">Prosperidad</option>
                    <option value="San Francisco">San Francisco</option>
                    <option value="Bayugan">Bayugan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Barangay</label>
                  <input 
                    required
                    value={barangay}
                    onChange={e => setBarangay(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Patin-ay"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700 mb-1">Pin Location on Map</label>
              <LocationPickerMap onLocationSelect={(lat, lng) => {
                setLat(lat)
                setLng(lng)
              }} />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 flex items-center border border-red-100">
                <span className="mr-2">⚠️</span> {errorMsg}
              </div>
            )}
            
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center text-lg"
            >
              {loading ? (
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Publish Activity'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
