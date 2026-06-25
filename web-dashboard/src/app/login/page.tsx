'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase' // Note: need to move lib to src/lib if needed, or update alias. Next.js with --src-dir defaults to @/ resolving to src/.

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    
    // We only simulate the login logic for UI building phase, or use actual supabase if setup.
    // For MVP, we'll try actual supabase:
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Non-IT Jargon Error Mapping
      if (error.message.includes('Invalid login credentials')) {
        setErrorMsg('Wrong email or password. Please try again.')
      } else {
        setErrorMsg('Something went wrong. Please check your connection and try again.')
      }
      setLoading(false)
      return
    }

    if (data.user) {
      // Fetch role
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (userData?.role === 'admin') {
        router.push('/lgu')
      } else if (userData?.role === 'nstp') {
        router.push('/nstp')
      } else {
        // Volunteers use mobile app, but if they login here
        setErrorMsg('Please use the Mobile App to access your Volunteer Dashboard.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        <div className="p-8">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">NSTP-CONNECT</h1>
            <p className="text-blue-200">Coordinators & LGU Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-blue-100 mb-1" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-blue-300/30 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-white placeholder-blue-300/50 transition-all outline-none"
                placeholder="juan@lgu.gov.ph"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100 mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-blue-300/30 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-white placeholder-blue-300/50 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>

            {errorMsg && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded-xl flex items-center text-sm">
                <span className="mr-2">⚠️</span> {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center text-lg"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </>
              ) : (
                'Login to Dashboard'
              )}
            </button>

            {/* Temporary testing section */}
            <div className="pt-6 mt-6 border-t border-white/10 text-center">
              <p className="text-sm text-blue-200 mb-4">Demo / Testing Options</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true);
                    const dynamicEmail = `admin_${Date.now()}@lgu.gov.ph`;
                    const { error } = await supabase.auth.signUp({ email: dynamicEmail, password: 'password123', options: { data: { role: 'admin', full_name: 'Super Admin' } } });
                    
                    if (error) {
                      setErrorMsg(`Signup Error: ${error.message}`);
                      setLoading(false);
                      return;
                    }

                    // Force update role directly
                    await supabase.from('users').update({ role: 'admin' }).eq('email', dynamicEmail);
                    setEmail(dynamicEmail);
                    setPassword('password123');
                    setLoading(false);
                    setErrorMsg('Admin account created! Click Login.');
                  }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors border border-white/20"
                >
                  Create LGU Admin
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true);
                    const dynamicEmail = `office_${Date.now()}@nstp.edu.ph`;
                    const { error } = await supabase.auth.signUp({ email: dynamicEmail, password: 'password123', options: { data: { role: 'nstp', full_name: 'NSTP Coordinator' } } });
                    
                    if (error) {
                      setErrorMsg(`Signup Error: ${error.message}`);
                      setLoading(false);
                      return;
                    }

                    // Force update role directly
                    await supabase.from('users').update({ role: 'nstp' }).eq('email', dynamicEmail);
                    setEmail(dynamicEmail);
                    setPassword('password123');
                    setLoading(false);
                    setErrorMsg('NSTP account created! Click Login.');
                  }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors border border-white/20"
                >
                  Create NSTP Office
                </button>
              </div>
              <p className="text-xs text-blue-300/60 mt-3 italic">
                Note: Ensure you've run the SQL schema in Supabase first!
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
