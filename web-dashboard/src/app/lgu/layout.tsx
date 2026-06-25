import DashboardLayout from '@/components/Layout/DashboardLayout'
import { ReactNode } from 'react'

export default function LguLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout role="lgu">{children}</DashboardLayout>
}
