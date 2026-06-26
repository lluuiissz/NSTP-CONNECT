'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Shield, UserPlus, Trash2, Mail, User, ShieldCheck } from 'lucide-react'

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'admin' // default to LGU Admin
  })

  useEffect(() => {
    fetchAdmins()
  }, [])

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['admin', 'nstp'])
        .order('role', { ascending: true })

      if (error) throw error
      setAdmins(data || [])
    } catch (err) {
      console.error("Error fetching admins:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      setSuccessMsg('Successfully created new administrator account!')
      setFormData({ fullName: '', email: '', password: '', role: 'admin' })
      fetchAdmins() // Refresh list

    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAdmin = async (id: string, role: string) => {
    if (!confirm('Are you sure you want to revoke this admin access? This removes them from the dashboard.')) return
    
    try {
      // For MVP, deleting from the public users table will strip their role,
      // effectively locking them out of the dashboard (due to RLS and route guards).
      const { error } = await supabase.from('users').delete().eq('id', id)
      if (error) throw error
      setAdmins(admins.filter(a => a.id !== id))
    } catch (err) {
      console.error("Error deleting admin:", err)
      alert("Failed to delete admin.")
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
          <Shield className="w-8 h-8 mr-3 text-indigo-600" />
          Admin Management
        </h1>
        <p className="text-slate-500 mt-2">Manage access for LGU Administrators and NSTP Coordinators.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sticky top-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
              <UserPlus className="w-5 h-5 mr-2 text-indigo-500" />
              Add New Admin
            </h2>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    required
                    value={formData.fullName}
                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Juan Dela Cruz"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="admin@lgu.gov.ph"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Temporary Password</label>
                <div className="relative">
                  <ShieldCheck className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Account Role</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="role" 
                      value="admin" 
                      checked={formData.role === 'admin'}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">LGU Admin</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="role" 
                      value="nstp" 
                      checked={formData.role === 'nstp'}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">NSTP Coordinator</span>
                  </label>
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm border border-green-100">
                  {successMsg}
                </div>
              )}

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 mt-4"
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>

        {/* Admin List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Current Administrators</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-100">
                    <th className="p-4 font-semibold text-slate-500 text-sm">Name & Email</th>
                    <th className="p-4 font-semibold text-slate-500 text-sm">Role Access</th>
                    <th className="p-4 font-semibold text-slate-500 text-sm text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-500">Loading administrators...</td>
                    </tr>
                  ) : admins.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-500">No administrators found.</td>
                    </tr>
                  ) : (
                    admins.map((admin) => (
                      <tr key={admin.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{admin.full_name}</div>
                          <div className="text-sm text-slate-500">{admin.email}</div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            admin.role === 'admin' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {admin.role === 'admin' ? 'LGU Admin' : 'NSTP Coordinator'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteAdmin(admin.id, admin.role)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Revoke Access"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
