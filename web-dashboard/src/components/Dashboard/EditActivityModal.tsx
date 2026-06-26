'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AGUSAN_DEL_SUR_LOCATIONS } from '@/lib/locations'
import { X } from 'lucide-react'

interface EditActivityModalProps {
  activity: any
  onClose: () => void
  onSave: (updatedActivity: any) => void
}

export default function EditActivityModal({ activity, onClose, onSave }: EditActivityModalProps) {
  const [title, setTitle] = useState(activity.title || '')
  const [description, setDescription] = useState(activity.description || '')
  
  // Format the date for the datetime-local input
  const initialDate = activity.event_date ? new Date(activity.event_date).toISOString().slice(0, 16) : ''
  const [eventDate, setEventDate] = useState(initialDate)
  
  const [municipality, setMunicipality] = useState(activity.municipality || '')
  const [barangay, setBarangay] = useState(activity.barangay || '')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const updatedFields = {
        title,
        description,
        event_date: new Date(eventDate).toISOString(),
        municipality,
        barangay,
      }

      const { data, error } = await supabase
        .from('activities')
        .update(updatedFields)
        .eq('id', activity.id)
        .select()
        .single()

      if (error) throw error

      onSave(data)
    } catch (err: any) {
      console.error('Error updating activity:', err)
      setErrorMsg(err.message || 'Failed to update activity')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Edit Activity</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="edit-activity-form" onSubmit={handleUpdate} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Event Title</label>
              <input 
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
              <textarea 
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Date & Time</label>
              <input 
                type="datetime-local"
                required
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Municipality</label>
                <select 
                  value={municipality}
                  onChange={e => {
                    setMunicipality(e.target.value)
                    setBarangay('')
                  }}
                  className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="" disabled>Select Municipality</option>
                  {Object.keys(AGUSAN_DEL_SUR_LOCATIONS).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Barangay</label>
                <select 
                  required
                  value={barangay}
                  onChange={e => setBarangay(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={!municipality}
                >
                  <option value="" disabled>Select Barangay</option>
                  {municipality && AGUSAN_DEL_SUR_LOCATIONS[municipality]?.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center border border-red-100 mt-2">
                <span className="mr-2">⚠️</span> {errorMsg}
              </div>
            )}
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="edit-activity-form"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        
      </div>
    </div>
  )
}
