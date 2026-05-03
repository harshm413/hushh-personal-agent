'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { useTimezone, formatInTimezone } from '@/hooks/useTimezone';

interface AuditEntry {
  id: string;
  userId: string;
  actionType: string;
  resource: string;
  resourceId?: string;
  personaId?: string;
  metadata?: Record<string, unknown>;
  hash: string;
  previousHash: string;
  createdAt: string;
}

interface Filters {
  actionType: string;
  dateFrom: string;
  dateTo: string;
  personaId: string;
}

const ACTION_TYPES = [
  'All',
  'data_read',
  'data_write',
  'data_delete',
  'consent_grant',
  'consent_revoke',
  'auth_login',
  'auth_logout',
  'auth_failed',
  'escalation_created',
  'escalation_resolved',
  'notification_sent',
];

const PERSONA_OPTIONS = ['All', 'kai', 'nav'];

const PAGE_SIZE = 20;

function getActionBadgeVariant(actionType: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (actionType.startsWith('data_read')) return 'secondary';
  if (actionType.startsWith('data_write')) return 'default';
  if (actionType.startsWith('data_delete') || actionType === 'auth_failed') return 'destructive';
  if (actionType.startsWith('consent_')) return 'outline';
  return 'secondary';
}

function formatTimestamp(iso: string, tz: string): string {
  return formatInTimezone(iso, tz, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const { timezone } = useTimezone();
  const [filters, setFilters] = useState<Filters>({
    actionType: 'All',
    dateFrom: '',
    dateTo: '',
    personaId: 'All',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = useCallback(async (currentPage: number, currentFilters: Filters) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('pageSize', String(PAGE_SIZE));
      if (currentFilters.actionType !== 'All') params.set('actionType', currentFilters.actionType);
      if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom);
      if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo);
      if (currentFilters.personaId !== 'All') params.set('personaId', currentFilters.personaId);

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setEntries(json.data);
        setTotalPages(json.totalPages);
        setChainValid(json.chainValid);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApplyFilters() {
    setPage(1);
    fetchEntries(1, filters);
  }

  function handlePrevious() {
    const prev = Math.max(1, page - 1);
    setPage(prev);
    fetchEntries(prev, filters);
  }

  function handleNext() {
    const next = Math.min(totalPages, page + 1);
    setPage(next);
    fetchEntries(next, filters);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Audit Trail</h1>

      {/* Chain verification status */}
      {chainValid !== null && (
        chainValid ? (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            <ShieldCheck className="size-5" />
            Chain Valid
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <ShieldAlert className="size-5" />
            Chain Integrity Compromised
          </div>
        )
      )}

      {/* Filter controls */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Action Type</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={filters.actionType}
                onChange={(e) => setFilters((f) => ({ ...f, actionType: e.target.value }))}
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Date From</label>
              <Input
                type="date"
                className="w-40"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Date To</label>
              <Input
                type="date"
                className="w-40"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Persona</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={filters.personaId}
                onChange={(e) => setFilters((f) => ({ ...f, personaId: e.target.value }))}
              >
                {PERSONA_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit entries list */}
      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {initialLoad ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading audit entries…
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No audit entries found.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {entries.map((entry) => (
                <div key={entry.id} className="py-3">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => toggleExpand(entry.id)}
                  >
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(entry.createdAt, timezone)}
                      </span>
                      <Badge variant={getActionBadgeVariant(entry.actionType)}>
                        {entry.actionType}
                      </Badge>
                      <span className="text-sm">{entry.resource}</span>
                      {entry.personaId && (
                        <span className="text-xs text-muted-foreground">
                          ({entry.personaId})
                        </span>
                      )}
                    </div>
                    {expandedId === entry.id ? (
                      <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {expandedId === entry.id && (
                    <div className="mt-2">
                      <Separator className="mb-2" />
                      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                        <code>{JSON.stringify(entry.metadata ?? {}, null, 2)}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="sm"
                className="min-w-8 h-8 px-2 text-xs"
                onClick={() => { setPage(p); fetchEntries(p, filters); }}
              >
                {p}
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-between w-full">
            <Button size="sm" variant="outline" className="w-24" disabled={page <= 1} onClick={handlePrevious}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <Button size="sm" variant="outline" className="w-24" disabled={page >= totalPages} onClick={handleNext}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
