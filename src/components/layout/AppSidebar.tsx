'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare,
  Lock,
  Shield,
  FileText,
  User as UserIcon,
  Calendar,
  Bell,
  Plus,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/chat/new', label: 'Chat', icon: MessageSquare },
  { href: '/vault', label: 'Vault', icon: Lock },
  { href: '/consent', label: 'Consent', icon: Shield },
  { href: '/audit', label: 'Audit Trail', icon: FileText },
  { href: '/profile', label: 'Profile', icon: UserIcon },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/notifications', label: 'Notifications', icon: Bell },
]

function SidebarContent() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <Link href="/chat" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">Hushh</span>
        </Link>
      </div>

      <div className="px-3">
        <Link
          href="/chat"
          className={cn(
            'inline-flex w-full items-center justify-start gap-2 rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium transition-colors hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50'
          )}
        >
          <Plus className="size-4" />
          New Chat
        </Link>
      </div>

      <Separator className="my-3" />

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/chat/new'
            ? pathname.startsWith('/chat')
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function AppSidebar({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean
  onClose?: () => void
}) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r bg-background flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar via Sheet */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}
