'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function NstpDashboardPage() {
  const [unverifiedUsers, setUnverifiedUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // Stores ID of user being acted upon

  useEffect(() => {
    fetchUnverifiedUsers()
  }, [])

  const fetchUnverifiedUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'volunteer')
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setUnverifiedUsers(data)
    }
    setLoading(false)
  }

  const handleAction = async (userId: string, action: 'approve' | 'reject') => {
    setActionLoading(userId)
    
    if (action === 'approve') {
      await supabase
        .from('users')
        .update({ is_verified: true })
        .eq('id', userId)
    } else {
      // In a real app, you might want to delete the user or mark them as rejected.
      // For MVP, we will just delete the user record to simulate rejection.
      await supabase
        .from('users')
        .delete()
        .eq('id', userId)
    }
    
    setUnverifiedUsers(prev => prev.filter(u => u.id !== userId))
    setActionLoading(null)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Volunteer Verification</h1>
        <p className="text-slate-500 mt-2">Review pending registrations to grant access to the mobile app.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white rounded-3xl border border-slate-200">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-slate-500 font-medium">Loading pending verifications...</p>
          </div>
        </div>
      ) : unverifiedUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">All Caught Up!</h3>
          <p className="text-slate-500 text-lg">There are no pending volunteer registrations to review right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {unverifiedUsers.map(user => (
            <div key={user.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row transition-all hover:shadow-md">
              {/* Certificate/ID Area */}
              <div className="w-full md:w-1/3 bg-slate-100 flex items-center justify-center p-8 border-b md:border-b-0 md:border-r border-slate-200 relative group">
                {user.certificate_url ? (
                  <img src={user.certificate_url} alt="NSTP Certificate" className="max-h-48 object-contain" />
                ) : (
                  <div className="text-center">
                    <div className="text-5xl mb-2">📄</div>
                    <div className="text-sm font-medium text-slate-500">No Certificate</div>
                  </div>
                )}
                
                {/* View Full Document Overlay */}
                {user.certificate_url && (
                  <a href={user.certificate_url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <span className="bg-white text-slate-900 font-bold px-4 py-2 rounded-lg text-sm shadow-lg">
                      View Full Document
                    </span>
                  </a>
                )}
              </div>

              {/* Info & Actions */}
              <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-slate-800">{user.full_name}</h3>
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full border border-yellow-200">
                      PENDING
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-slate-600 mt-4">
                    <div><strong className="text-slate-900 font-medium">Email:</strong> {user.email}</div>
                    <div><strong className="text-slate-900 font-medium">NSTP:</strong> {user.nstp_component || 'N/A'}</div>
                    <div><strong className="text-slate-900 font-medium">Municipality:</strong> {user.municipality || 'N/A'}</div>
                    <div><strong className="text-slate-900 font-medium">Barangay:</strong> {user.barangay || 'N/A'}</div>
                  </div>
                </div>

                {/* Massive Action Buttons (Aesthetic Minimalism & Strong Hierarchy) */}
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button 
                    onClick={() => handleAction(user.id, 'reject')}
                    disabled={actionLoading !== null}
                    className={`flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-lg transition-all ${
                      actionLoading === user.id ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 hover:border-red-300 active:scale-95'
                    }`}
                  >
                    {actionLoading === user.id ? 'Processing...' : '❌ Reject'}
                  </button>

                  <button 
                    onClick={() => handleAction(user.id, 'approve')}
                    disabled={actionLoading !== null}
                    className={`flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-lg transition-all shadow-sm ${
                      actionLoading === user.id ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600 active:scale-95'
                    }`}
                  >
                    {actionLoading === user.id ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Approving...
                      </>
                    ) : '✅ Approve'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
