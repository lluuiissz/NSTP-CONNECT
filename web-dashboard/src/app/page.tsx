'use client'

import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowRight, Smartphone, ShieldCheck, HeartHandshake } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function WelcomePage() {
  const [downloadUrl, setDownloadUrl] = useState('https://nstp-connect.vercel.app/download-app')

  // In a real production scenario, we would determine the host dynamically if needed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDownloadUrl(`${window.location.origin}/download-app`)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white overflow-hidden relative font-sans">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      {/* Navbar Area */}
      <nav className="relative z-10 container mx-auto px-6 py-6 flex justify-between items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="text-2xl font-black tracking-tighter"
        >
          NSTP<span className="text-blue-400">-CONNECT</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link 
            href="/login" 
            className="hidden md:inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-2 rounded-full font-medium transition-colors border border-white/10"
          >
            Coordinator Login <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-6 pt-12 pb-24 lg:pt-24 lg:pb-32 flex flex-col lg:flex-row items-center justify-between gap-16">
        
        {/* Left: Hero Text */}
        <div className="flex-1 text-center lg:text-left">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-tight mb-6"
          >
            Empowering <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Volunteers</span><br/>
            Across Agusan Del Sur
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg lg:text-xl text-blue-100/80 max-w-2xl mx-auto lg:mx-0 mb-10"
          >
            The centralized platform for NSTP Coordinators, LGU Admins, and student volunteers. Track hours, join activities, and make a real impact in your community.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
          >
            {/* Mobile Call to Action Button for Admins on small screens */}
            <Link 
              href="/login" 
              className="md:hidden inline-flex justify-center items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 px-8 py-4 rounded-xl font-bold transition-all shadow-lg"
            >
              Coordinator Login <ArrowRight className="w-5 h-5" />
            </Link>
            
            <div className="flex items-center justify-center lg:justify-start gap-6 mt-6 lg:mt-0 text-blue-200">
              <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-green-400"/> GPS Verified</div>
              <div className="flex items-center gap-2"><HeartHandshake className="w-5 h-5 text-red-400"/> Community First</div>
            </div>
          </motion.div>
        </div>

        {/* Right: QR Code & Download Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.5, type: "spring" }}
          className="flex-1 w-full max-w-md lg:max-w-sm"
        >
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 mb-4">
                <Smartphone className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Volunteer App</h3>
              <p className="text-sm text-blue-100/70">Scan the QR code to download the mobile app and start tracking your service hours!</p>
            </div>

            <div className="bg-white p-4 rounded-2xl mx-auto w-max shadow-inner mb-6 transition-transform hover:scale-105">
              <QRCodeSVG 
                value={downloadUrl} 
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#1e293b"}
                level={"H"}
                includeMargin={false}
              />
            </div>
            
            <div className="text-center text-xs font-mono text-blue-200/50">
              {downloadUrl}
            </div>
          </div>
        </motion.div>

      </main>
    </div>
  )
}
