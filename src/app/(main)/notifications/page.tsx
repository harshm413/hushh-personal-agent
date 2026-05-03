'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, DollarSign, Users, Calendar, CheckCheck, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  linkedResource: string | null;
  createdAt: string;
}

interface NotificationPreference {
  notificationType: string;
  enabled: boolean;
  pushEnabled: boolean;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  system_notification: Bell,
  financial_alert: DollarSign,
  contact_reminder: Users,
  calendar_reminder: Calendar,
};

const PREF_LABELS: Record<string, string> = {
  financial_alert: 'Financial Alerts',
  contact_reminder: 'Contact Reminders',
  calendar_reminder: 'Calendar Reminders',
  system_notification: 'System Notifications',
};

const PREF_TYPES = Object.keys(PREF_LABELS);

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

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[] | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data: Notification[] = await res.json();
        setNotifications(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences');
      if (res.ok) {
        const data: NotificationPreference[] = await res.json();
        setPreferences(data);
        setPushEnabled(data.some((p) => p.pushEnabled));
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchNotifications(), fetchPreferences()]).finally(() =>
      setLoading(false)
    );
  }, [fetchNotifications, fetchPreferences]);

  async function handleMarkAsRead(n: Notification) {
    if (!n.read) {
      try {
        await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' });
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
        );
      } catch {
        // silently fail
      }
    }
    const route = parseLinkedResource(n.linkedResource);
    if (route) router.push(route);
  }

  async function handleMarkAllAsRead() {
    try {
      await fetch('/api/notifications', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silently fail
    }
  }

  async function handleClearAll() {
    try {
      await fetch('/api/notifications', { method: 'DELETE' });
      setNotifications([]);
    } catch {
      // silently fail
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // silently fail
    }
  }

  async function handleTogglePref(type: string, enabled: boolean) {
    const prev = preferences ?? [];
    const updated = prev.map((p) =>
      p.notificationType === type ? { ...p, enabled } : p
    );
    setPreferences(updated);
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationType: type, enabled }),
      });
    } catch {
      // revert on failure
      setPreferences(prev);
    }
  }

  async function handleTogglePush(enabled: boolean) {
    const prev = pushEnabled;
    setPushEnabled(enabled);
    try {
      // Update pushEnabled for all notification types
      const prefs = preferences ?? [];
      await Promise.all(
        PREF_TYPES.map((type) => {
          const existing = prefs.find((p) => p.notificationType === type);
          return fetch('/api/notifications/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notificationType: type,
              enabled: existing?.enabled ?? true,
              pushEnabled: enabled,
            }),
          });
        })
      );
      // Refresh preferences to reflect the change
      await fetchPreferences();
    } catch {
      setPushEnabled(prev);
    }
  }

  const unread = notifications.filter((n) => !n.read);

  function renderNotification(n: Notification) {
    const Icon = TYPE_ICONS[n.type] ?? Bell;
    return (
      <div key={n.id} className="flex items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/50">
        <button
          type="button"
          className="flex flex-1 items-start gap-3 text-left"
          onClick={() => handleMarkAsRead(n)}
        >
          <div className="mt-0.5 shrink-0 rounded-full bg-muted p-2">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium leading-tight">{n.title}</span>
              {!n.read && (
                <span className="size-2 shrink-0 rounded-full bg-blue-500" aria-label="Unread" />
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
            <span className="mt-1 text-[10px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
          </div>
        </button>
        <button
          type="button"
          className="mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          onClick={() => handleDelete(n.id)}
          aria-label="Delete notification"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <div className="flex gap-2">
          {unread.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheck className="mr-1.5 size-4" />
              Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              <Trash2 className="mr-1.5 size-4" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="unread">
            <div className="border-b px-4 pt-3">
              <TabsList>
                <TabsTrigger value="unread">
                  Unread
                  {unread.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5">
                      {unread.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="unread">
              {loading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
              ) : unread.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No unread notifications
                </div>
              ) : (
                <div className="divide-y divide-border">{unread.map(renderNotification)}</div>
              )}
            </TabsContent>

            <TabsContent value="all">
              {loading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-border">{notifications.map(renderNotification)}</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {preferences === null ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              {PREF_TYPES.map((type) => {
                const pref = preferences.find((p) => p.notificationType === type);
                const enabled = pref?.enabled ?? true;
                return (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm">{PREF_LABELS[type]}</span>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => handleTogglePref(type, checked)}
                      aria-label={`Toggle ${PREF_LABELS[type]}`}
                    />
                  </div>
                );
              })}
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Push Notifications</span>
                  <p className="text-xs text-muted-foreground">Receive push notifications in your browser</p>
                </div>
                <Switch
                  checked={pushEnabled ?? false}
                  onCheckedChange={handleTogglePush}
                  aria-label="Toggle push notifications"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
