import DashboardLayout from '@/components/Layout/DashboardLayout'
import { ReactNode } from 'react'

export default function NstpLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout role="nstp">{children}</DashboardLayout>
}
