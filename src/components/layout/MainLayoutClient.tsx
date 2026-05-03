'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppHeader } from '@/components/layout/AppHeader'

export function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Chat conversation pages manage their own layout (sidebar + chat window)
  // so they need no padding and no parent scroll — they fill the entire area
  const isChatConversation = /^\/chat\/[^/]+$/.test(pathname)

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <AppHeader onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
        <div
          className={
            isChatConversation
              ? 'flex-1 min-h-0 overflow-hidden'
              : 'flex-1 min-h-0 overflow-auto p-4 md:p-6'
          }
        >
          {children}
        </div>
      </main>
    </div>
  )
}
