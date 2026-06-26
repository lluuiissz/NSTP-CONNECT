import { Download, Info, ShieldCheck, Smartphone } from 'lucide-react'
import Link from 'next/link'

export default function DownloadAppPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
      
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 md:p-12 rounded-3xl shadow-2xl max-w-md w-full text-center relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-blue-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white mb-6 shadow-lg">
          <Smartphone className="w-10 h-10" />
        </div>
        
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">NSTP-CONNECT</h1>
        <p className="text-blue-200 mb-8 font-medium">Volunteer Mobile Application</p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-green-400 shrink-0" />
            <div>
              <h3 className="font-bold text-white text-sm">GPS Tracking Verified</h3>
              <p className="text-xs text-blue-200/70 mt-1">Automatically logs your exact service hours using advanced geolocation.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-blue-400 shrink-0" />
            <div>
              <h3 className="font-bold text-white text-sm">Version 1.0.0 (Android)</h3>
              <p className="text-xs text-blue-200/70 mt-1">Compatible with Android 8.0 and above. iOS version coming soon.</p>
            </div>
          </div>
        </div>

        <a 
          href="/nstp-connect.apk"
          download="NSTP-CONNECT.apk"
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform transition-all active:scale-95 flex justify-center items-center gap-3 text-lg mb-4"
        >
          <Download className="w-6 h-6" />
          Download APK
        </a>

        <p className="text-xs text-blue-300/60 leading-relaxed">
          If prompted by your phone, you may need to go to Settings &gt; Security and allow "Install from unknown sources" to install this prototype.
        </p>

      </div>
      
      <div className="mt-8 text-center text-sm text-blue-300/50">
        <Link href="/" className="hover:text-white transition-colors">
          &larr; Back to Home
        </Link>
      </div>

    </div>
  )
}
