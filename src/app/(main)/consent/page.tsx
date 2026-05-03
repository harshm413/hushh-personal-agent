'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ConsentToggleRow } from '@/components/consent/ConsentToggleRow';
import { ConsentHistory } from '@/components/consent/ConsentHistory';
import { useTimezone } from '@/hooks/useTimezone';

// Which data scopes each persona can actually access (mirrors personas.ts allowedDataScopes)
const KAI_SCOPES = new Set(['financial_record', 'preference']);
const NAV_SCOPES = new Set(['contact', 'calendar_event', 'preference', 'booking']);

const DATA_CATEGORIES = [
  { fieldId: 'financial_record', label: 'Financial Records', description: 'Transaction history, portfolio holdings, and budget data' },
  { fieldId: 'contact', label: 'Contacts', description: 'Contact information and relationship data' },
  { fieldId: 'calendar_event', label: 'Calendar', description: 'Calendar events and scheduling data' },
  { fieldId: 'preference', label: 'Preferences', description: 'Personal preferences and settings' },
  { fieldId: 'booking', label: 'Bookings', description: 'Booking and reservation data' },
];

interface Toggle {
  id: string;
  userId: string;
  dataFieldId: string;
  enabled: boolean;
  personaScope: string;
  updatedAt: string;
}

interface HistoryEntry {
  timestamp: string;
  fieldId: string;
  action: 'grant' | 'revoke';
  personaScope: string;
}

const PAGE_SIZE = 10;

export default function ConsentPage() {
  const [toggles, setToggles] = useState<Toggle[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exactDate, setExactDate] = useState('');
  const [filterMode, setFilterMode] = useState<'none' | 'exact' | 'range'>('none');
  const { timezone } = useTimezone();

  const fetchToggles = useCallback(async () => {
    try {
      const res = await fetch('/api/consent');
      if (res.ok) setToggles(await res.json());
    } catch {
      // silently fail
    }
  }, []);

  const fetchHistory = useCallback(async (page: number, from?: string, to?: string) => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      // Send local-time start/end as ISO strings so the server filters correctly
      if (from) {
        params.set('dateFrom', new Date(from + 'T00:00:00').toISOString());
      }
      if (to) {
        const end = new Date(to + 'T23:59:59.999');
        params.set('dateTo', end.toISOString());
      }
      const res = await fetch(`/api/consent/history?${params}`);
      if (res.ok) {
        const { data, total }: { data: HistoryEntry[]; total: number } = await res.json();
        setHistory(data);
        setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
        setHasMore(data.length >= PAGE_SIZE);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchToggles(), fetchHistory(1)]).finally(() => setLoading(false));
  }, [fetchToggles, fetchHistory]);

  function isEnabled(fieldId: string, persona: 'kai' | 'nav'): boolean {
    // Check for exact persona match or 'both' scope
    return toggles.some(
      (t) => t.dataFieldId === fieldId && t.enabled && (t.personaScope === persona || t.personaScope === 'both')
    );
  }

  async function handleToggleChange(fieldId: string, persona: 'kai' | 'nav', enabled: boolean) {
    // Optimistic update
    setToggles((prev) => {
      const updated = prev.map((t) =>
        t.dataFieldId === fieldId && (t.personaScope === persona || t.personaScope === 'both')
          ? { ...t, enabled: t.personaScope === persona ? enabled : t.personaScope === 'both' ? false : t.enabled, updatedAt: new Date().toISOString() }
          : t
      );
      // Ensure a row exists for this persona scope
      if (!updated.find((t) => t.dataFieldId === fieldId && t.personaScope === persona)) {
        updated.push({ id: '', userId: '', dataFieldId: fieldId, enabled, personaScope: persona, updatedAt: new Date().toISOString() });
      }
      return updated;
    });

    try {
      await fetch('/api/consent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId, enabled, personaScope: persona }),
      });
      // Re-fetch to get accurate state from server
      await fetchToggles();
      await fetchHistory(1, 
        filterMode === 'exact' ? exactDate || undefined : dateFrom || undefined,
        filterMode === 'exact' ? exactDate || undefined : dateTo || undefined
      );
      setHistoryPage(1);
    } catch {
      await fetchToggles();
    }
  }

  function handlePageChange(page: number) {
    setHistoryPage(page);
    fetchHistory(page,
      filterMode === 'exact' ? exactDate || undefined : dateFrom || undefined,
      filterMode === 'exact' ? exactDate || undefined : dateTo || undefined
    );
  }

  function handleDateFilterChange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    setExactDate('');
    setFilterMode(from || to ? 'range' : 'none');
    setHistoryPage(1);
    fetchHistory(1, from || undefined, to || undefined);
  }

  function handleExactDateChange(date: string) {
    setExactDate(date);
    setDateFrom('');
    setDateTo('');
    setFilterMode(date ? 'exact' : 'none');
    setHistoryPage(1);
    fetchHistory(1, date || undefined, date || undefined);
  }

  function handleClearFilters() {
    setDateFrom('');
    setDateTo('');
    setExactDate('');
    setFilterMode('none');
    setHistoryPage(1);
    fetchHistory(1);
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading consent settings…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Consent Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Consent Toggles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {DATA_CATEGORIES.map((cat) => (
              <ConsentToggleRow
                key={cat.fieldId}
                fieldId={cat.fieldId}
                label={cat.label}
                description={cat.description}
                kaiEnabled={isEnabled(cat.fieldId, 'kai')}
                navEnabled={isEnabled(cat.fieldId, 'nav')}
                kaiAllowed={KAI_SCOPES.has(cat.fieldId)}
                navAllowed={NAV_SCOPES.has(cat.fieldId)}
                onChange={handleToggleChange}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consent History</CardTitle>
        </CardHeader>
        <CardContent>
          <ConsentHistory
            history={history}
            page={historyPage}
            totalPages={totalPages}
            hasMore={hasMore}
            onPageChange={handlePageChange}
            dateFrom={dateFrom}
            dateTo={dateTo}
            exactDate={exactDate}
            filterMode={filterMode}
            onDateFilterChange={handleDateFilterChange}
            onExactDateChange={handleExactDateChange}
            onClearFilters={handleClearFilters}
            timezone={timezone}
          />
        </CardContent>
      </Card>
    </div>
  );
}
