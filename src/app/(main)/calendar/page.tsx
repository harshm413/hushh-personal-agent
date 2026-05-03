'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, MapPin, Clock, Repeat } from 'lucide-react';
import { toast } from 'sonner';

interface CalendarEventData {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
}

/* Form state separates date and time for clarity */
interface EventFormState {
  title: string;
  description: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  endDate: string;     // YYYY-MM-DD (repeat-until, shown when recurrence !== 'none')
  location: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
}

interface CalendarEntry {
  id: string;
  decryptedData: {
    type: 'calendar_event';
    data: CalendarEventData;
  };
}

const RECURRENCE_OPTIONS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;

function groupByDate(events: CalendarEntry[]): Record<string, CalendarEntry[]> {
  const groups: Record<string, CalendarEntry[]> = {};
  for (const event of events) {
    const dateKey = event.decryptedData.data.startTime.slice(0, 10);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(event);
  }
  return groups;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeading(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}


const emptyForm: EventFormState = {
  title: '',
  description: '',
  date: '',
  startTime: '',
  endTime: '',
  endDate: '',
  location: '',
  recurrence: 'none',
};

type TimeFilter = 'all' | 'past' | 'today' | 'this_week' | 'upcoming';

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getWeekEnd(): string {
  const d = new Date();
  d.setDate(d.getDate() + (7 - d.getDay()));
  return d.toISOString().slice(0, 10);
}

function categorizeDate(dateKey: string, endDate?: string): 'past' | 'today' | 'this_week' | 'upcoming' {
  const today = getToday();
  const weekEnd = getWeekEnd();
  // If the event's end date is today or later, it's not fully past
  const effectiveDate = endDate && endDate >= today ? (dateKey < today ? today : dateKey) : dateKey;
  if (effectiveDate < today) return 'past';
  if (effectiveDate === today) return 'today';
  if (effectiveDate <= weekEnd) return 'this_week';
  return 'upcoming';
}

const SECTION_ORDER: ('past' | 'today' | 'this_week' | 'upcoming')[] = ['today', 'this_week', 'upcoming', 'past'];
const SECTION_LABELS: Record<string, string> = {
  past: '📋 Past Events',
  today: '📌 Today',
  this_week: '📅 This Week',
  upcoming: '🔮 Upcoming',
};

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEntry | null>(null);
  const [form, setForm] = useState<EventFormState>({ ...emptyForm });
  const [filter, setFilter] = useState<TimeFilter>('all');

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch {
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function openAdd() {
    setEditingEvent(null);
    setForm({ ...emptyForm });
    setShowAddDialog(true);
  }

  function openEdit(entry: CalendarEntry) {
    setEditingEvent(entry);
    const d = entry.decryptedData.data;
    const startDt = new Date(d.startTime);
    const endDt = new Date(d.endTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    const toDateStr = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const toTimeStr = (dt: Date) => `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    setForm({
      title: d.title,
      description: d.description ?? '',
      date: toDateStr(startDt),
      startTime: toTimeStr(startDt),
      endTime: toTimeStr(endDt),
      endDate: d.recurrence !== 'none' ? toDateStr(endDt) : '',
      location: d.location ?? '',
      recurrence: d.recurrence,
    });
    setShowAddDialog(true);
  }

  function closeDialog() {
    setShowAddDialog(false);
    setEditingEvent(null);
    setForm({ ...emptyForm });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Combine date + time into ISO strings
    const startIso = new Date(`${form.date}T${form.startTime}`).toISOString();
    // For recurring events, endTime uses endDate; for single events, same date as start
    const endDateStr = form.recurrence !== 'none' && form.endDate ? form.endDate : form.date;
    const endIso = new Date(`${endDateStr}T${form.endTime}`).toISOString();

    const payload = {
      data: {
        title: form.title,
        description: form.description || undefined,
        startTime: startIso,
        endTime: endIso,
        location: form.location || undefined,
        recurrence: form.recurrence,
      },
    };

    try {
      if (editingEvent) {
        const res = await fetch(`/api/calendar/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setEvents((prev) => prev.map((ev) => (ev.id === editingEvent.id ? updated : ev)));
          toast.success('Event updated');
        } else {
          toast.error('Failed to update event');
        }
      } else {
        const res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setEvents((prev) =>
            [...prev, created].sort((a, b) =>
              a.decryptedData.data.startTime.localeCompare(b.decryptedData.data.startTime)
            )
          );
          toast.success('Event created');
        } else {
          toast.error('Failed to create event');
        }
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      closeDialog();
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this event?')) return;
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEvents((prev) => prev.filter((ev) => ev.id !== id));
        toast.success('Event deleted');
      } else {
        toast.error('Failed to delete event');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  const grouped = groupByDate(events);
  const sortedDates = Object.keys(grouped).sort();

  // Group dates into sections
  // For each date group, find the latest endTime to determine if any event is still ongoing
  const latestEndByDate: Record<string, string> = {};
  for (const date of sortedDates) {
    let latest = '';
    for (const ev of grouped[date]) {
      const end = ev.decryptedData.data.endTime.slice(0, 10);
      if (end > latest) latest = end;
    }
    latestEndByDate[date] = latest;
  }

  const sections: Record<string, string[]> = { past: [], today: [], this_week: [], upcoming: [] };
  for (const date of sortedDates) {
    sections[categorizeDate(date, latestEndByDate[date])].push(date);
  }

  // Filter
  const visibleSections = filter === 'all' ? SECTION_ORDER : SECTION_ORDER.filter((s) => s === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={filter}
            onChange={(e) => setFilter(e.target.value as TimeFilter)}
          >
            <option value="all">All Events</option>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            Add Event
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No calendar events yet. Add your first event to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleSections.map((section) => {
            const dates = sections[section];
            if (dates.length === 0) return null;
            return (
              <div key={section} className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-muted-foreground border-b border-border pb-1">
                  {SECTION_LABELS[section]}
                </h2>
                {dates.map((date) => (
                  <div key={date} className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium text-muted-foreground pl-1">
                      {formatDateHeading(date)}
                    </h3>
                    {grouped[date].map((entry) => {
                      const d = entry.decryptedData.data;
                      const isPast = categorizeDate(date, d.endTime.slice(0, 10)) === 'past';
                      return (
                        <Card key={entry.id} className={isPast ? 'opacity-60' : ''}>
                          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                            <CardTitle className="text-base font-medium">{d.title}</CardTitle>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(entry)}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDelete(entry.id)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5" />
                              {formatTime(d.startTime)} – {formatTime(d.endTime)}
                            </span>
                            {d.startTime.slice(0, 10) !== d.endTime.slice(0, 10) && (
                              <span className="text-xs">
                                {new Date(d.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                {' → '}
                                {new Date(d.endTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {d.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3.5" />
                                {d.location}
                              </span>
                            )}
                            {d.recurrence !== 'none' && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Repeat className="size-3" />
                                {d.recurrence}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
          {visibleSections.every((s) => sections[s].length === 0) && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No events in this category.
            </div>
          )}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cal-title" className="text-sm font-medium">Title</label>
              <Input
                id="cal-title"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cal-desc" className="text-sm font-medium">Description</label>
              <Input
                id="cal-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cal-date" className="text-sm font-medium">Date</label>
              <Input
                id="cal-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cal-start-time" className="text-sm font-medium">Start Time</label>
                <Input
                  id="cal-start-time"
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cal-end-time" className="text-sm font-medium">End Time</label>
                <Input
                  id="cal-end-time"
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cal-location" className="text-sm font-medium">Location</label>
              <Input
                id="cal-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cal-recurrence" className="text-sm font-medium">Recurrence</label>
              <select
                id="cal-recurrence"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.recurrence}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recurrence: e.target.value as CalendarEventData['recurrence'] }))
                }
              >
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            {form.recurrence !== 'none' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cal-end-date" className="text-sm font-medium">Repeat Until</label>
                <Input
                  id="cal-end-date"
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit">{editingEvent ? 'Save Changes' : 'Create Event'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
