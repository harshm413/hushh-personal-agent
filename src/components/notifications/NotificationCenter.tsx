'use client';

import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/useNotifications';

function parseLinkedResource(linked: string | null): string | null {
  if (!linked) return null;
  const [type, id] = linked.split(':');
  if (type === 'vault') return '/vault';
  if (type === 'conversation') return `/chat/${id}`;
  return null;
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function NotificationCenter() {
  const router = useRouter();
  const { unreadCount, notifications, markAsRead, markAllAsRead } = useNotifications();
  const latest = notifications.slice(0, 5);

  async function handleClick(id: string, linkedResource: string | null) {
    await markAsRead(id);
    const route = parseLinkedResource(linkedResource);
    if (route) router.push(route);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />
        }
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {latest.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No unread notifications
          </div>
        ) : (
          latest.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
              onClick={() => handleClick(n.id, n.linkedResource)}
            >
              <span className="text-sm font-medium leading-tight">{n.title}</span>
              <span className="text-xs text-muted-foreground line-clamp-1">{n.body}</span>
              <span className="text-[10px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        {latest.length > 1 && (
          <>
            <DropdownMenuItem
              className="justify-center text-xs text-muted-foreground cursor-pointer"
              onClick={() => markAllAsRead()}
            >
              Mark all as read
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          className="justify-center text-sm font-medium text-primary cursor-pointer"
          onClick={() => router.push('/notifications')}
        >
          View All
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
