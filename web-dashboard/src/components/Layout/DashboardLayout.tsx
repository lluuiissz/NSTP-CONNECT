import Link from 'next/link'
import { ReactNode } from 'react'
import { 
  LogOut, 
  Map as MapIcon, 
  MapPin, 
  BarChart3, 
  FileCheck,
  Megaphone,
  ClipboardList,
  Database
} from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
  role: 'lgu' | 'nstp'
}

const lguLinks = [
  { name: 'Live Radar Map', href: '/lgu', icon: MapIcon },
  { name: 'Volunteer Heatmap', href: '/lgu/heatmap', icon: BarChart3 },
  { name: 'Activity Management', href: '/lgu/activities', icon: MapPin },
  { name: 'Activity Logs', href: '/lgu/activity-logs', icon: ClipboardList },
  { name: 'Emergency Broadcasts', href: '/lgu/broadcast', icon: Megaphone },
  { name: 'Student Masterlist', href: '/lgu/records', icon: Database },
];

const nstpLinks = [
  { name: 'Verification Queue', href: '/nstp', icon: FileCheck },
  { name: 'Student Masterlist', href: '/nstp/records', icon: Database },
];

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar - Follows Jakob's Law for standard navigation placement */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6">
          <h2 className="text-2xl font-bold tracking-tight text-blue-400">NSTP-CONNECT</h2>
          <p className="text-sm text-slate-400 mt-1 uppercase tracking-wider font-semibold">
            {role === 'lgu' ? 'LGU Portal' : 'NSTP Office'}
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {role === 'lgu' ? (
            <>
              {lguLinks.map((link) => (
                <SidebarLink key={link.href} href={link.href} icon={<link.icon size={20} />} label={link.name} />
              ))}
            </>
          ) : (
             <>
              {nstpLinks.map((link) => (
                <SidebarLink key={link.href} href={link.href} icon={<link.icon size={20} />} label={link.name} />
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Link 
            href="/login"
            className="flex items-center w-full px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="mr-3"><LogOut size={20} /></span> Logout
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-slate-200 h-16 flex items-center px-8 z-0">
          {/* Aesthetic Minimalism: Clean top bar */}
          <div className="flex-1"></div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              {role === 'lgu' ? 'L' : 'N'}
            </div>
            <span className="font-medium text-slate-700">
              {role === 'lgu' ? 'LGU Admin' : 'NSTP Coordinator'}
            </span>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

function SidebarLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link 
      href={href}
      className="flex items-center px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors group"
    >
      <span className="mr-3 text-xl group-hover:scale-110 transition-transform">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}
