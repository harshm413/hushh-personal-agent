'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  linkedResource: string | null;
  createdAt: string;
}

const POLL_INTERVAL = 30_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerCheck = useCallback(async () => {
    try {
      await fetch('/api/notifications/check', { method: 'POST' });
    } catch {
      // silently fail
    }
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?read=false');
      if (res.ok) {
        const data: Notification[] = await res.json();
        setNotifications(data);
        setUnreadCount(data.length);
      }
    } catch {
      // silently fail
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch('/api/notifications', { method: 'PATCH' });
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }, []);

  const refresh = useCallback(() => {
    fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    // On mount: trigger check then fetch
    triggerCheck().then(() => fetchUnread());
    // Poll: trigger check then fetch every 30s
    intervalRef.current = setInterval(() => {
      triggerCheck().then(() => fetchUnread());
    }, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [triggerCheck, fetchUnread]);

  return { unreadCount, notifications, markAsRead, markAllAsRead, refresh };
}
