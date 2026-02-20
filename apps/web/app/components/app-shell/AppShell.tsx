'use client'

import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
// import { MobileBottomNav } from './MobileBottomNav'  // Disabled per user request
import { MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/app/context/AuthContext'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { permissions } = useAuth()
  const canUseChat = permissions.includes('chat.use')

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      {/* <MobileBottomNav /> */}
      {canUseChat && (
        <Link
          href="/dashboard/chat"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 hover:bg-primary/90"
          aria-label="Chat"
        >
          <MessageSquare className="h-6 w-6" />
        </Link>
      )}
    </div>
  )
}
