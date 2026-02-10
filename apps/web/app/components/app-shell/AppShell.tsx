'use client'

import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { MobileBottomNav } from './MobileBottomNav'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
