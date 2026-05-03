'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatInTimezone } from '@/hooks/useTimezone';

interface ConsentHistoryEntry {
  timestamp: string;
  fieldId: string;
  action: 'grant' | 'revoke';
  personaScope: string;
}

interface ConsentHistoryProps {
  history: ConsentHistoryEntry[];
  page: number;
  totalPages: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  dateFrom: string;
  dateTo: string;
  exactDate: string;
  filterMode: 'none' | 'exact' | 'range';
  onDateFilterChange: (from: string, to: string) => void;
  onExactDateChange: (date: string) => void;
  onClearFilters: () => void;
  timezone?: string;
}

const SCOPE_LABELS: Record<string, string> = {
  both: 'Both',
  kai: 'Kai',
  nav: 'Nav',
};

function formatTimestamp(ts: string, tz: string = 'UTC'): string {
  return formatInTimezone(ts, tz, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const dimmed = 'opacity-40 pointer-events-none';

export function ConsentHistory({
  history, page, totalPages, hasMore, onPageChange,
  dateFrom, dateTo, exactDate, filterMode,
  onDateFilterChange, onExactDateChange, onClearFilters, timezone = 'UTC',
}: ConsentHistoryProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-3 mb-2 flex-wrap">
        <div className={`flex items-center gap-1.5 ${filterMode === 'range' ? dimmed : ''}`}>
          <label className="text-xs text-muted-foreground">Date</label>
          <input
            type="date"
            value={exactDate}
            onChange={(e) => onExactDateChange(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground">or</span>
        <div className={`flex items-center gap-1.5 ${filterMode === 'exact' ? dimmed : ''}`}>
          <label className="text-xs text-muted-foreground">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFilterChange(e.target.value, dateTo)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <label className="text-xs text-muted-foreground">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateFilterChange(dateFrom, e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        {filterMode !== 'none' && (
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={onClearFilters}>
            Clear
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No consent changes recorded{filterMode !== 'none' ? ' for this date range' : ' yet'}.
        </p>
      ) : (
        <>
          {history.map((entry, i) => (
            <div
              key={`${entry.timestamp}-${entry.fieldId}-${i}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatTimestamp(entry.timestamp, timezone)}
              </span>
              <span className="flex-1 truncate font-medium">{entry.fieldId}</span>
              <Badge
                className={
                  entry.action === 'grant'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }
                variant="outline"
              >
                {entry.action === 'grant' ? 'Grant' : 'Revoke'}
              </Badge>
              <span className="shrink-0 text-xs text-muted-foreground">
                {SCOPE_LABELS[entry.personaScope] ?? entry.personaScope}
              </span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  className="min-w-8 h-8 px-2 text-xs"
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                className="w-24"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {page} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                className="w-24"
                disabled={!hasMore}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
